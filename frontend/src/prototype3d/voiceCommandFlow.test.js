import test from 'node:test'
import assert from 'node:assert/strict'
import { createVoiceController } from '../game/ai/gnani/voiceController.js'
import { createPrismaAdapter } from '../game/ai/gnani/prismaAdapter.js'
import { createTimbreAdapter } from '../game/ai/gnani/timbreAdapter.js'
import { createBabylonVoiceActionDispatcher } from './voiceActionDispatcher.js'
import { executeBabylonVoiceIntent } from './voiceActionExecutor.js'
import { canExecuteArenaVoiceAction } from './voiceActionRules.js'
import { executeInstantDefeat, findNearestEnemyTarget } from './playerCombat.js'
import { renderVoicePanel } from '../game/ui/VoicePanel.js'

class MockNode {
  textContent = ''
  hidden = false
  disabled = false
  dataset = {}
  listeners = new Map()
  addEventListener(type, listener) { this.listeners.set(type, listener) }
  removeEventListener(type) { this.listeners.delete(type) }
  async click() { return this.listeners.get('click')?.() }
}

function panelFixture() {
  const nodes = Object.fromEntries(['record', 'stop', 'cancel', 'status', 'detail', 'transcript', 'recognizedIntent',
    'validatedIntent', 'dispatcherResult', 'rejectionReason', 'lastActionStatus']
    .map((name) => [name, new MockNode()]))
  const selectors = {
    '[data-voice-record]': nodes.record,
    '[data-voice-stop]': nodes.stop,
    '[data-voice-cancel]': nodes.cancel,
    '[data-voice-status]': nodes.status,
    '[data-voice-status-label]': new MockNode(),
    '[data-voice-detail]': nodes.detail,
    '[data-voice-transcript]': nodes.transcript,
    '[data-voice-diagnostic="recognized-intent"]': nodes.recognizedIntent,
    '[data-voice-diagnostic="validated-intent"]': nodes.validatedIntent,
    '[data-voice-diagnostic="dispatcher-result"]': nodes.dispatcherResult,
    '[data-voice-diagnostic="rejection-reason"]': nodes.rejectionReason,
    '[data-voice-diagnostic="last-action-status"]': nodes.lastActionStatus,
  }
  return { nodes, root: { querySelector: (selector) => selectors[selector] } }
}

test('shared VoicePanel renders transcript, status, provider and all diagnostic rows for Babylon', () => {
  const panel = renderVoicePanel({ diagnostics: true, showTranscript: true })
  assert.match(panel, /RECOGNIZED SPEECH/)
  assert.match(panel, /data-voice-transcript/)
  assert.match(panel, /Dispatcher status/)
  assert.match(panel, /Action result/)
  assert.match(panel, /Rejection reason/)
  for (const provider of ['prisma', 'groq', 'timbre']) assert.match(panel, new RegExp(`data-voice-provider="${provider}"`))
})

const proposal = (action, parameters = {}) => ({
  version: 1,
  game: 'babylon-3d',
  action,
  parameters,
})

test('Babylon voice flow records, transcribes, displays, speaks via Timbre, and dispatches only explicit valid proposals', async () => {
  const { nodes, root } = panelFixture()
  const events = []
  const dispatched = []
  const gameActions = []
  const arena = { controller: {
    setVirtualKey: (key, pressed) => gameActions.push(`interact:${key}:${pressed}`),
    startAttack: (type) => gameActions.push(`attack:${type}`),
    triggerAbility: () => gameActions.push('ability'),
  } }
  let state = { status: 'active', availableActions: new Set([
    'interact_nearest', 'light_attack', 'heavy_attack', 'class_ability', 'use_consumable',
  ]), targetDistance: 2.5, stamina: 40, abilityCooldownRemaining: 0, classId: 'warrior',
  abilityCost: 28, abilityRange: 5.2, consumables: new Set(['health-potion']), health: 50, maxHealth: 100 }
  const dispatch = createBabylonVoiceActionDispatcher({
    getState: () => state,
    canExecute: (intent, liveState) => liveState.availableActions.has(intent.action)
      && canExecuteArenaVoiceAction(intent, liveState, {
        classId: liveState.classId,
        findNearestInteraction: () => liveState.targetDistance <= 3.1,
        findNearestActiveEnemy: () => true,
        findAttackTarget: (range) => liveState.targetDistance <= range,
        abilityCooldownRemaining: liveState.abilityCooldownRemaining,
        abilityCost: liveState.abilityCost,
        abilityRange: liveState.abilityRange,
        canUseItem: (currentState, itemId) => currentState.consumables.has(itemId)
          && currentState.health < currentState.maxHealth,
      }),
    execute: (intent) => {
      dispatched.push(intent.action)
      events.push(`action:${intent.action}`)
      return executeBabylonVoiceIntent(intent, {
        arena,
        handleHudAction: (action, itemId) => gameActions.push(`${action}:${itemId}`),
      })
    },
  })
  const fetchImpl = async (url, options = {}) => {
    events.push(url)
    if (url === '/api/health') return Response.json({ configured: true, groq: { configured: true }, evon: { configured: false } })
    if (url === '/api/voice/transcribe') {
      assert.equal(options.headers['Content-Type'], 'audio/wav')
      return Response.json({ transcript: 'Use a health potion', detectedLanguageCode: 'en-IN' })
    }
    if (url === '/api/voice/interpret') {
      assert.deepEqual(JSON.parse(options.body), { transcript: 'Use a health potion', game: 'babylon-3d' })
      // Explicit mocked Groq fixture; the automated test does not call a live model.
      return Response.json({ intent: proposal('use_consumable', { itemId: 'health-potion' }) })
    }
    if (url === '/api/voice/speak') {
      const body = JSON.parse(options.body)
      assert.match(body.text, /accepted the use consumable command/)
      return new Response(new Uint8Array([82, 73, 70, 70]), { headers: { 'content-type': 'audio/wav' } })
    }
    throw new Error(`Unexpected request: ${url}`)
  }
  let played
  const controller = createVoiceController(root, {
    game: 'babylon-3d',
    recorderFactory: () => ({
      async start() {
        events.push('microphone-start')
        return { stop: async () => new Blob(['recorded audio'], { type: 'audio/wav' }), cancel: async () => {} }
      },
    }),
    prisma: createPrismaAdapter({ fetchImpl }),
    timbre: createTimbreAdapter({ fetchImpl }),
    fetchImpl,
    play: async (audio) => { events.push('audio-play'); played = audio },
    onIntent: (intent) => dispatch.dispatch(intent),
  })

  await nodes.record.click()
  assert.equal(nodes.status.dataset.state, 'listening')
  await nodes.stop.click()
  assert.equal(nodes.transcript.textContent, 'Use a health potion')
  assert.match(nodes.detail.textContent, /Groq interpreted the command/)
  assert.equal(played.type, 'audio/wav')
  assert.deepEqual(dispatched, ['use_consumable'], 'the explicit validated Groq fixture uses the existing dispatcher')

  // Explicit schema-valid fixtures below are test inputs, never attributed to Evon or a live Groq call.
  for (const fixture of [
    proposal('interact_nearest'),
    proposal('light_attack'),
    proposal('heavy_attack'),
    proposal('class_ability'),
    proposal('use_consumable', { itemId: 'health-potion' }),
  ]) {
    assert.equal(controller.dispatchIntent(fixture).ok, true, fixture.action)
  }
  assert.deepEqual(dispatched, ['use_consumable', 'interact_nearest', 'light_attack', 'heavy_attack', 'class_ability', 'use_consumable'])
  assert.deepEqual(gameActions, [
    'use-item:health-potion',
    'interact:e:true',
    'attack:light',
    'attack:heavy',
    'ability',
    'use-item:health-potion',
  ])
  assert.ok(events.indexOf('/api/voice/transcribe') < events.indexOf('/api/voice/speak'))
  assert.ok(events.indexOf('/api/voice/interpret') < events.indexOf('action:use_consumable'))
  assert.ok(events.indexOf('/api/voice/speak') < events.indexOf('audio-play'))

  state = { ...state, status: 'defeat' }
  assert.equal(controller.dispatchIntent(proposal('light_attack')).ok, false, 'inactive mission rejected')
  state = { ...state, status: 'active', availableActions: new Set(['light_attack']) }
  assert.equal(controller.dispatchIntent(proposal('heavy_attack')).ok, false, 'unavailable action rejected')
  assert.equal(controller.dispatchIntent(proposal('use_consumable', { itemId: 'health-potion' })).ok, false,
    'unavailable consumable rejected')
  assert.equal(controller.dispatchIntent(proposal('use_consumable', { itemId: 'unknown-item' })).ok, false,
    'unsupported item rejected')
  assert.equal(controller.dispatchIntent({ ...proposal('light_attack'), parameters: { damage: 999 } }).ok, false,
    'malformed action parameters rejected')

  controller.destroy()
})

test('spoken Attack the enemy accepts a distant light attack and defeats exactly the nearest enemy', async () => {
  const { nodes, root } = panelFixture()
  const state = { status: 'active', stamina: 90 }
  const enemies = [
    { id: 'nearest', name: 'Goblin Warrior', health: 72, position: { x: 180, z: 0 }, defeated: false },
    { id: 'farther', name: 'Sentinel', health: 260, position: { x: 260, z: 0 }, defeated: false },
    { id: 'already-defeated', name: 'Fallen Goblin', health: 0, position: { x: 1, z: 0 }, defeated: true },
  ]
  const target = () => findNearestEnemyTarget(enemies, { x: 0, z: 0 })
  let rewardExecutions = 0
  const arena = {
    controller: {},
    executeVoiceAttack(type) {
      assert.equal(type, 'light')
      const chosen = target()
      const before = chosen?.health
      const hit = executeInstantDefeat(chosen, (enemyId, amount) => {
        const enemy = enemies.find(({ id }) => id === enemyId)
        if (!enemy || enemy.defeated) return false
        enemy.health = Math.max(0, enemy.health - amount)
        if (enemy.health === 0) {
          enemy.defeated = true
          rewardExecutions += 1
        }
        return true
      })
      return hit && chosen?.health === 0
        ? { ok: true, actionResult: `${chosen.name}: ${before} → 0 HP.` }
        : { ok: false, error: 'No active enemies found.', actionResult: 'Attack not executed.' }
    },
  }
  const dispatcher = createBabylonVoiceActionDispatcher({
    getState: () => state,
    canExecute: (intent, liveState) => canExecuteArenaVoiceAction(intent, liveState, {
      classId: 'warrior',
      findNearestActiveEnemy: target,
      canStartAttack: () => true,
    }),
    getRejectionReason: () => target() ? 'The attack is not available.' : 'No active enemies found.',
    execute: (intent) => executeBabylonVoiceIntent(intent, { arena }),
  })
  const requests = []
  const fetchImpl = async (url, options = {}) => {
    requests.push(url)
    if (url === '/api/health') return Response.json({ groq: { configured: true } })
    if (url === '/api/voice/transcribe') {
      assert.equal(options.headers['Content-Type'], 'audio/wav')
      return Response.json({ transcript: 'Attack the enemy', detectedLanguageCode: 'en-IN' })
    }
    if (url === '/api/voice/interpret') {
      assert.deepEqual(JSON.parse(options.body), { transcript: 'Attack the enemy', game: 'babylon-3d' })
      return Response.json({ intent: proposal('light_attack') })
    }
    if (url === '/api/voice/speak') {
      assert.match(JSON.parse(options.body).text, /accepted the light_attack command/)
      return new Response(new Uint8Array([82, 73, 70, 70]), { headers: { 'content-type': 'audio/wav' } })
    }
    throw new Error(`Unexpected request: ${url}`)
  }
  const controller = createVoiceController(root, {
    game: 'babylon-3d',
    recorderFactory: () => ({ start: async () => ({ stop: async () => new Blob(['audio']), cancel: async () => {} }) }),
    prisma: createPrismaAdapter({ fetchImpl }),
    timbre: createTimbreAdapter({ fetchImpl }),
    fetchImpl,
    play: async () => {},
    onIntent: (intent) => dispatcher.dispatch(intent),
  })

  await nodes.record.click()
  await nodes.stop.click()
  assert.equal(nodes.transcript.textContent, 'Attack the enemy')
  assert.equal(nodes.dispatcherResult.textContent, 'ACCEPTED')
  assert.equal(enemies[0].health, 0)
  assert.equal(enemies[0].defeated, true)
  assert.equal(enemies[1].health, 260, 'the farther enemy is untouched')
  assert.equal(enemies[2].health, 0, 'the already defeated enemy remains unchanged')
  assert.equal(rewardExecutions, 1, 'the chosen target reward path runs exactly once')
  assert.deepEqual(requests, ['/api/health', '/api/voice/transcribe', '/api/voice/interpret', '/api/voice/speak'])
  enemies[1].health = 0
  enemies[1].defeated = true
  const noEnemies = dispatcher.dispatch(proposal('light_attack'))
  assert.equal(noEnemies.ok, false)
  assert.equal(noEnemies.error, 'No active enemies found.')
  controller.destroy()
})

test('Babylon dispatcher gates schema-valid actions on range, stamina, ability cooldown, and usable inventory fixtures', () => {
  const state = {
    status: 'active',
    targetDistance: 2.5,
    stamina: 40,
    abilityCooldownRemaining: 0,
    classId: 'warrior',
    consumables: new Set(['health-potion']),
    health: 50,
    maxHealth: 100,
  }
  const executed = []
  const canExecute = (intent, liveState) => canExecuteArenaVoiceAction(intent, liveState, {
    classId: liveState.classId,
    findNearestInteraction: () => liveState.targetDistance <= 3.1,
    findNearestActiveEnemy: () => true,
    findAttackTarget: (range) => liveState.targetDistance <= range,
    abilityCooldownRemaining: liveState.abilityCooldownRemaining,
    abilityCost: liveState.classId === 'mage' ? 34 : liveState.classId === 'guardian' ? 26 : 28,
    abilityRange: liveState.classId === 'mage' ? 24 : 5.2,
    canUseItem: (currentState, itemId) => currentState.consumables.has(itemId)
      && currentState.health < currentState.maxHealth,
  })
  const dispatcher = createBabylonVoiceActionDispatcher({
    getState: () => state,
    canExecute,
    execute: (intent) => { executed.push(intent.action) },
  })
  const fixtures = [
    proposal('interact_nearest'),
    proposal('light_attack'),
    proposal('heavy_attack'),
    proposal('class_ability'),
    proposal('use_consumable', { itemId: 'health-potion' }),
  ]
  for (const fixture of fixtures) assert.equal(dispatcher.dispatch(fixture).ok, true, fixture.action)

  state.targetDistance = 4
  assert.equal(dispatcher.dispatch(proposal('interact_nearest')).ok, false, 'interaction range is enforced')
  assert.equal(dispatcher.dispatch(proposal('light_attack')).ok, true, 'light attack accepts a distant active enemy')
  state.targetDistance = 3
  state.stamina = 29
  assert.equal(dispatcher.dispatch(proposal('heavy_attack')).ok, false, 'heavy attack stamina is enforced')
  state.stamina = 40
  state.abilityCooldownRemaining = 0.1
  assert.equal(dispatcher.dispatch(proposal('class_ability')).ok, false, 'ability cooldown is enforced')
  state.abilityCooldownRemaining = 0
  state.consumables.delete('health-potion')
  assert.equal(dispatcher.dispatch(proposal('use_consumable', { itemId: 'health-potion' })).ok, false,
    'missing item is rejected')
  assert.equal(executed.length, fixtures.length + 1, 'only the distant light attack is newly accepted')
})
