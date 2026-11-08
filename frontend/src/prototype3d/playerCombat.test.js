import assert from 'node:assert/strict'
import test from 'node:test'
import { createThirdPersonController } from './playerController.js'
import { createBabylonVoiceActionDispatcher } from './voiceActionDispatcher.js'
import { executeBabylonVoiceIntent } from './voiceActionExecutor.js'
import { canExecuteArenaVoiceAction } from './voiceActionRules.js'
import {
  calculatePlayerAttackDamage,
  canStartPlayerAttack,
  directionToTarget,
  executeInstantDefeat,
  findNearestEnemyTarget,
  getPlayerAttackRange,
} from './playerCombat.js'

const fixtureIntent = (action) => ({ version: 1, game: 'babylon-3d', action, parameters: {} })

function controllerFixture({ type, stamina = 90, status = 'active', targetDistance = 2 } = {}) {
  const oldWindow = globalThis.window
  const oldDocument = globalThis.document
  const listeners = new Map()
  const renderCallbacks = new Map()
  let observerId = 0
  globalThis.window = {
    addEventListener: (name, callback) => listeners.set(name, callback),
    removeEventListener: (name) => listeners.delete(name),
  }
  globalThis.document = {
    hidden: false,
    addEventListener() {},
    removeEventListener() {},
  }
  const state = {
    status,
    stamina,
    health: 100,
    enemies: { goblin: { health: 72, maxHealth: 72, defeated: false } },
  }
  const progress = {
    getState: () => state,
    dispatch(action) {
      if (action.type === 'spend-stamina') state.stamina -= action.amount
      if (action.type === 'damage-enemy' && !state.enemies.goblin.defeated) {
        state.enemies.goblin.health = Math.max(0, state.enemies.goblin.health - action.amount)
        state.enemies.goblin.defeated = state.enemies.goblin.health === 0
      }
      return state
    },
    save() {},
  }
  const target = { id: 'goblin', position: { x: targetDistance, z: 0 }, radius: 0.82 }
  const ui = { enemyHealth: 100, enemyHealthText: '72 / 72' }
  let damageDealt = 0
  const attackCalls = []
  const syncHud = () => {
    ui.enemyHealth = state.enemies.goblin.health / 72 * 100
    ui.enemyHealthText = `${state.enemies.goblin.health} / 72`
  }
  const onAttack = (attackType, options = {}) => {
    attackCalls.push({ type: attackType, options })
    const range = getPlayerAttackRange(attackType, 'warrior')
    if ((!options.instantDefeat && targetDistance > range) || state.status !== 'active' || state.enemies.goblin.defeated) return false
    if (options.instantDefeat) {
      return executeInstantDefeat({ ...target, health: state.enemies.goblin.health }, (enemyId, amount) => {
        progress.dispatch({ type: 'damage-enemy', enemyId, amount })
        syncHud()
        return true
      })
    }
    damageDealt = calculatePlayerAttackDamage({ type: attackType, classId: 'warrior' })
    progress.dispatch({ type: 'damage-enemy', enemyId: 'goblin', amount: damageDealt })
    syncHud()
    return true
  }
  const scene = {
    onBeforeRenderObservable: {
      add(callback) { const id = ++observerId; renderCallbacks.set(id, callback); return id },
      remove(id) { renderCallbacks.delete(id) },
    },
    getEngine: () => ({ getDeltaTime: () => 16 }),
  }
  const character = {
    root: { position: { x: 0, y: 0, z: 0 } },
    setMotion() {},
    playAction() {},
  }
  const controller = createThirdPersonController({
    scene,
    canvas: { addEventListener() {}, removeEventListener() {} },
    camera: { alpha: 0, setTarget() {} },
    character,
    progress,
    collides: () => false,
    onAttack,
    onAbility: () => false,
    onInteract: () => false,
    onMessage: () => {},
  })
  return {
    controller,
    state,
    ui,
    target,
    get damageDealt() { return damageDealt },
    attackCalls,
    key(key) { return listeners.get('keydown')?.({ key, target: { matches: () => false }, repeat: false, preventDefault() {} }) },
    dispose() {
      controller.dispose()
      globalThis.window = oldWindow
      globalThis.document = oldDocument
    },
  }
}

test('J and K call the same validated combat handler and update Goblin HP and its HUD without damaging player', () => {
  for (const key of ['j', 'k']) {
    const fixture = controllerFixture()
    const beforePlayerHealth = fixture.state.health
    fixture.key(key)
    assert.ok(fixture.state.enemies.goblin.health < 72, `${key.toUpperCase()} reduces Goblin HP`)
    assert.equal(fixture.ui.enemyHealthText, `${fixture.state.enemies.goblin.health} / 72`)
    assert.equal(fixture.ui.enemyHealth, fixture.state.enemies.goblin.health / 72 * 100)
    assert.equal(fixture.state.health, beforePlayerHealth, 'attacking does not damage the player')
    fixture.dispose()
  }
})

test('physical J instantly defeats only the nearest active enemy anywhere through the enemy-hit handler', () => {
  const fixture = controllerFixture({ targetDistance: 250 })
  fixture.key('j')
  assert.equal(fixture.state.enemies.goblin.health, 0)
  assert.equal(fixture.state.enemies.goblin.defeated, true)
  assert.equal(fixture.ui.enemyHealthText, '0 / 72')
  assert.equal(fixture.state.health, 100)
  fixture.dispose()

  const enemies = [
    { id: 'near', health: 25, position: { x: 250, z: 0 } },
    { id: 'far', health: 60, position: { x: 300, z: 0 } },
    { id: 'farthest', health: 80, position: { x: 400, z: 0 } },
  ]
  const nearest = findNearestEnemyTarget(enemies, { x: 0, z: 0 })
  const defeated = []
  const handled = executeInstantDefeat(nearest, (enemyId, damage, source) => {
    const enemy = enemies.find(({ id }) => id === enemyId)
    enemy.health = Math.max(0, enemy.health - damage)
    defeated.push({ enemyId, source })
    return true
  })
  assert.equal(handled, true)
  assert.equal(enemies[0].health, 0)
  assert.equal(enemies[1].health, 60)
  assert.equal(enemies[2].health, 80)
  assert.deepEqual(defeated, [{ enemyId: 'near', source: 'Strike' }])
})

test('instant defeat does nothing without an in-range enemy or with an invalid target', () => {
  let called = false
  assert.equal(executeInstantDefeat(null, () => { called = true }), false)
  assert.equal(executeInstantDefeat({ id: 'already-dead', health: 0 }, () => { called = true }), false)
  assert.equal(executeInstantDefeat({ id: 'invalid', health: Number.NaN }, () => { called = true }), false)
  assert.equal(called, false)
})

test('only a physical J key press requests instant defeat; K and voice controller calls keep normal damage', () => {
  const fixture = controllerFixture()
  fixture.key('j')
  assert.equal(fixture.attackCalls[0].type, 'light')
  assert.equal(fixture.attackCalls[0].options.instantDefeat, true)
  fixture.dispose()

  const keyboardHeavy = controllerFixture()
  keyboardHeavy.key('k')
  assert.equal(keyboardHeavy.attackCalls[0].type, 'heavy')
  assert.equal(keyboardHeavy.attackCalls[0].options.instantDefeat, undefined)
  assert.ok(keyboardHeavy.state.enemies.goblin.health > 0)
  keyboardHeavy.dispose()

  const voice = controllerFixture()
  voice.controller.startAttack('light')
  assert.equal(voice.attackCalls[0].options.instantDefeat, undefined)
  assert.ok(voice.state.enemies.goblin.health > 0)
  voice.dispose()
})

test('voice light and heavy attacks share the controller attack handler and damage the intended target', () => {
  for (const action of ['light_attack', 'heavy_attack']) {
    const fixture = controllerFixture()
    const dispatcher = createBabylonVoiceActionDispatcher({
      getState: () => fixture.state,
      canExecute: (intent, state) => canExecuteArenaVoiceAction(intent, state, {
        classId: 'warrior',
        findNearestActiveEnemy: () => fixture.target,
        findAttackTarget: (range) => fixture.target && 2 <= range ? fixture.target : null,
        canStartAttack: (type) => fixture.controller.canStartAttack(type),
      }),
      execute: (intent) => executeBabylonVoiceIntent(intent, { arena: { controller: fixture.controller } }),
    })
    const result = dispatcher.dispatch(fixtureIntent(action))
    assert.equal(result.ok, true)
    assert.ok(fixture.state.enemies.goblin.health < 72)
    assert.equal(fixture.ui.enemyHealthText, `${fixture.state.enemies.goblin.health} / 72`)
    assert.equal(fixture.state.health, 100)
    fixture.dispose()
  }
})

test('light voice attack validation accepts an active target beyond all normal attack ranges', () => {
  assert.equal(getPlayerAttackRange('light', 'mage'), 20)
  assert.equal(getPlayerAttackRange('light', 'warrior'), 3.1)
  assert.equal(getPlayerAttackRange('heavy', 'mage'), 3.8)
  const state = { status: 'active', stamina: 40 }
  assert.equal(canExecuteArenaVoiceAction(fixtureIntent('light_attack'), state, {
    classId: 'mage', findNearestActiveEnemy: () => ({ id: 'boss', health: 260, position: { x: 1000, z: 0 } }),
    findAttackTarget: () => false, canStartAttack: () => true,
  }), true)
})

test('light attacks reject missing active enemies; other attack restrictions remain enforced', () => {
  assert.equal(canExecuteArenaVoiceAction(fixtureIntent('light_attack'), { status: 'active', stamina: 50 }, {
    classId: 'warrior', findNearestActiveEnemy: () => null, canStartAttack: () => true,
  }), false, 'missing active enemies rejected')
  assert.equal(canStartPlayerAttack({ type: 'light', status: 'active', paused: false, stamina: 13, cooldownRemaining: 0 }), false)
  assert.equal(canStartPlayerAttack({ type: 'heavy', status: 'active', paused: false, stamina: 30, cooldownRemaining: 0.1 }), false)
  assert.equal(canStartPlayerAttack({ type: 'light', status: 'defeat', paused: false, stamina: 90, cooldownRemaining: 0 }), false)
  const fixture = controllerFixture()
  fixture.key('j')
  const firstHealth = fixture.state.enemies.goblin.health
  assert.equal(fixture.controller.startAttack('light'), false, 'attack cooldown blocks repeat input')
  assert.equal(fixture.state.enemies.goblin.health, firstHealth)
  fixture.dispose()

  const defeated = controllerFixture()
  defeated.state.enemies.goblin.defeated = true
  assert.equal(defeated.controller.startAttack('light'), false, 'defeated enemy cannot receive more damage')
  assert.equal(defeated.state.enemies.goblin.health, 72)
  defeated.dispose()
})

test('keyboard and voice heavy attacks use the same damage calculation', () => {
  for (const [key, action] of [['k', 'heavy_attack']]) {
    const keyboard = controllerFixture()
    keyboard.key(key)
    const keyboardDamage = keyboard.damageDealt
    keyboard.dispose()

    const voice = controllerFixture()
    const dispatcher = createBabylonVoiceActionDispatcher({
      getState: () => voice.state,
      canExecute: (intent, state) => canExecuteArenaVoiceAction(intent, state, {
        classId: 'warrior',
        findNearestActiveEnemy: () => voice.target,
        findAttackTarget: (range) => 2 <= range ? voice.target : null,
        canStartAttack: (type) => voice.controller.canStartAttack(type),
      }),
      execute: (intent) => executeBabylonVoiceIntent(intent, { arena: { controller: voice.controller } }),
    })
    assert.equal(dispatcher.dispatch(fixtureIntent(action)).ok, true)
    assert.equal(voice.damageDealt, keyboardDamage)
    voice.dispose()
  }
})

test('ranged Mage target aiming follows the acquired target instead of a stale facing vector', () => {
  const aim = directionToTarget({ x: 0, z: 0 }, { x: 12, z: 5 })
  assert.ok(Math.abs(Math.hypot(aim.x, aim.z) - 1) < 1e-9)
  assert.ok(aim.x > 0 && aim.z > 0)
})

test('voice attack dispatch stays PROCESSING and is accepted only after attack execution confirms enemy HP loss', async () => {
  const state = { status: 'active', enemyHp: 72 }
  let finishAttack
  const dispatcher = createBabylonVoiceActionDispatcher({
    getState: () => state,
    canExecute: () => true,
    execute: () => new Promise((resolve) => { finishAttack = resolve }),
  })
  const pending = dispatcher.dispatch(fixtureIntent('light_attack'))
  assert.equal(typeof pending.then, 'function')
  state.enemyHp = 38
  finishAttack({ ok: true, actionResult: `Goblin Warrior: 72 → ${state.enemyHp} HP.` })
  const result = await pending
  assert.equal(result.ok, true)
  assert.equal(result.actionResult, 'Goblin Warrior: 72 → 38 HP.')
})
