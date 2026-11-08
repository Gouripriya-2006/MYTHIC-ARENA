import test from 'node:test'
import assert from 'node:assert/strict'
import {
  canExecutePhaserVoiceAttack,
  createPhaserVoiceActionDispatcher,
  isWithinPhaserAttackRange,
} from './voiceActionDispatcher.js'
import { executePhaserAttack, executePhaserVoiceAction } from '../scenes/phaserAttackHandler.js'
import { createGameStore } from '../state/gameStore.js'

const intent = (action, game = 'phaser-2d', parameters = {}) => ({ version: 1, game, action, parameters })

test('Phaser dispatcher delegates validated interactions and successful attacks to scene handlers', () => {
  const executed = []
  const scene = {
    canExecuteVoiceAction: () => true,
    executeVoiceAction: (action) => { executed.push(action); return true },
  }
  const dispatcher = createPhaserVoiceActionDispatcher(scene)
  assert.equal(dispatcher.dispatch(intent('interact_nearest')).ok, true)
  assert.equal(dispatcher.dispatch(intent('light_attack')).ok, true)
  assert.deepEqual(executed, ['interact_nearest', 'light_attack'])
})

test('Phaser dispatcher reports an execution rejection instead of success', () => {
  const dispatcher = createPhaserVoiceActionDispatcher({
    canExecuteVoiceAction: () => true,
    executeVoiceAction: () => false,
  })
  const result = dispatcher.dispatch(intent('light_attack'))
  assert.equal(result.ok, false)
  assert.match(result.error, /game rejected/)
  assert.equal(result.intent.action, 'light_attack', 'schema-valid intent remains available for diagnostics after execution rejection')
})

test('dispatcher returns the validated intent with the actual game-state rejection', () => {
  const dispatcher = createPhaserVoiceActionDispatcher({
    canExecuteVoiceAction: () => false,
    executeVoiceAction() { assert.fail('rejected actions must not execute') },
  })
  const result = dispatcher.dispatch(intent('light_attack'))
  assert.equal(result.ok, false)
  assert.equal(result.intent.action, 'light_attack')
  assert.equal(result.error, 'That action is not available in the current game state.')
})

test('accepted voice light_attack invokes the real Phaser attack handler and combat effects', () => {
  const events = []
  let state = {
    status: 'active',
    sentinelHealth: 90,
    characterId: 'warrior',
    objectives: { relic: true, sentinel: false },
  }
  const scene = {
    store: {
      getState: () => state,
      attackSentinel() { state.sentinelHealth -= 30 },
      defeatSentinel() { state = { ...state, sentinelHealth: 0, objectives: { ...state.objectives, sentinel: true } } },
    },
    player: { x: 0, y: 0 },
    sentinel: { x: 120, y: 0, setVisible() {} },
    sentinelBody: { setAlpha: (value) => events.push(`flash:${value}`) },
    sentinelAura: { destroy() {} },
    sentinelLabel: { setVisible() {} },
    time: { now: 1000, delayedCall: (delay) => events.push(`reset:${delay}`) },
    lastAttack: 0,
    audio: { play: (sound) => events.push(`sound:${sound}`) },
    onMessage: (message) => events.push(`message:${message}`),
    cameras: { main: { shake: (duration) => events.push(`shake:${duration}`) } },
  }
  let attackHandlerCalls = 0
  scene.canExecuteVoiceAction = (action) => action === 'light_attack' && canExecutePhaserVoiceAttack({
    state,
    player: scene.player,
    sentinel: scene.sentinel,
    now: scene.time.now,
    lastAttack: scene.lastAttack,
  })
  scene.attack = (options) => {
    attackHandlerCalls += 1
    return executePhaserAttack(scene, options)
  }
  scene.executeVoiceAction = (action) => executePhaserVoiceAction(scene, action)

  const result = createPhaserVoiceActionDispatcher(scene).dispatch(intent('light_attack'))
  assert.equal(result.ok, true)
  assert.equal(attackHandlerCalls, 1)
  assert.equal(state.sentinelHealth, 0)
  assert.equal(state.objectives.sentinel, true)
  assert.deepEqual(events, [
    'sound:player-light',
    'sound:enemy-hit',
    'flash:0.48',
    'reset:150',
    'sound:enemy-defeat',
    'message:The Veil Sentinel crumbles. The ancient gate awaits.',
    'shake:90',
  ])
})

function createStoreBackedAttackScene(distance = 120) {
  const store = createGameStore({ classId: 'warrior', name: 'Attack Regression' })
  store.recoverRelic()
  const scene = {
    store,
    player: { x: 600, y: 280 },
    sentinel: { x: 600 + distance, y: 280, setVisible() {} },
    sentinelBody: { setAlpha() {} },
    time: { now: 1000, delayedCall() {} },
    lastAttack: 0,
    audio: { play() {} },
    onMessage() {},
    cameras: { main: { shake() {} } },
    sentinelAura: { destroy() {} },
    sentinelLabel: { setVisible() {} },
    canExecuteVoiceAction(action) {
      return action === 'light_attack' && canExecutePhaserVoiceAttack({
        state: store.getState(),
        player: this.player,
        sentinel: this.sentinel,
        now: this.time.now,
        lastAttack: this.lastAttack,
      })
    },
    attack(options) {
      return executePhaserAttack(this, options)
    },
  }
  scene.executeVoiceAction = (action) => executePhaserVoiceAction(scene, action)
  return { scene, store }
}

test('voice light_attack instantly defeats the distant Sentinel and leaves player health unchanged', () => {
  const { scene, store } = createStoreBackedAttackScene(500)
  const playerHealthBefore = store.getState().health
  const sentinelHealthBefore = store.getState().sentinelHealth

  const result = createPhaserVoiceActionDispatcher(scene).dispatch(intent('light_attack'))

  assert.equal(result.ok, true)
  assert.equal(store.getState().sentinelHealth, 0)
  assert.equal(store.getState().objectives.sentinel, true)
  assert.equal(store.getState().health, playerHealthBefore)
})

test('manual SPACE attack handler damages the Sentinel and leaves player health unchanged', () => {
  const { scene, store } = createStoreBackedAttackScene(100)
  const playerHealthBefore = store.getState().health
  const sentinelHealthBefore = store.getState().sentinelHealth

  // The SPACE key callback is `() => this.attack()`, so this exercises that same handler call.
  const result = scene.attack()

  assert.equal(result, true)
  assert.equal(store.getState().sentinelHealth, sentinelHealthBefore - 30)
  assert.equal(store.getState().health, playerHealthBefore)
})

test('manual SPACE attack still does no damage beyond its original 104-unit range', () => {
  const { scene, store } = createStoreBackedAttackScene(120)
  const sentinelHealthBefore = store.getState().sentinelHealth

  const result = scene.attack()

  assert.equal(result, false)
  assert.equal(store.getState().sentinelHealth, sentinelHealthBefore)
})

const attackState = (overrides = {}) => ({ status: 'active', sentinelHealth: 90, ...overrides })
const attackContext = (overrides = {}) => ({
  state: attackState({ objectives: { relic: true } }),
  player: { x: 600, y: 280 },
  sentinel: { x: 658, y: 280 },
  now: 1000,
  lastAttack: 580,
  ...overrides,
})

test('voice attack rejects an attempt inside Phaser’s 420ms cooldown', () => {
  assert.equal(canExecutePhaserVoiceAttack(attackContext({ lastAttack: 581 })), false)
})

test('voice attack becomes available exactly at the 420ms cooldown boundary', () => {
  assert.equal(canExecutePhaserVoiceAttack(attackContext({ lastAttack: 580 })), true)
})

test('voice attacks accept the active Sentinel regardless of distance', () => {
  for (const distance of [104, 120, 160, 500]) {
    assert.equal(canExecutePhaserVoiceAttack(attackContext({
      player: { x: 0, y: 0 },
      sentinel: { x: distance, y: 0 },
    })), true, `${distance} units should be within voice attack range`)
  }
  assert.equal(canExecutePhaserVoiceAttack(attackContext({
    player: { x: 0, y: 0 },
    sentinel: { x: 1000, y: 0 },
  })), true, 'distance must not reject an active enemy')
})

test('manual Phaser attacks retain the strict 104-unit range boundary', () => {
  assert.equal(isWithinPhaserAttackRange(103.99, 104), true)
  assert.equal(isWithinPhaserAttackRange(104, 104), false)
  assert.equal(isWithinPhaserAttackRange(120, 104), false)
})

test('voice attack rejects inactive missions and unavailable enemies, not distance', () => {
  assert.equal(canExecutePhaserVoiceAttack(attackContext({ state: attackState({ status: 'defeat' }) })), false)
  assert.equal(canExecutePhaserVoiceAttack(attackContext({ state: attackState({ sentinelHealth: 0 }) })), false)
  assert.equal(canExecutePhaserVoiceAttack(attackContext({ state: attackState({ objectives: { relic: false } }) })), false)
})

test('Phaser rejects unsupported or malformed intents without calling gameplay handlers', () => {
  let executions = 0
  const dispatcher = createPhaserVoiceActionDispatcher({
    canExecuteVoiceAction: () => false,
    executeVoiceAction: () => { executions += 1; return true },
  })
  assert.equal(dispatcher.dispatch(intent('heavy_attack')).ok, false)
  assert.equal(dispatcher.dispatch(intent('light_attack', 'babylon-3d')).ok, false)
  assert.equal(dispatcher.dispatch({ ...intent('light_attack'), parameters: { damage: 900 } }).ok, false)
  assert.equal(executions, 0)
})
