import test from 'node:test'
import assert from 'node:assert/strict'
import { createVoiceController } from './voiceController.js'
import { createPrismaAdapter } from './prismaAdapter.js'
import { createTimbreAdapter } from './timbreAdapter.js'
import { createGroqAdapter } from './groqAdapter.js'
import {
  canExecutePhaserVoiceAttack,
  createPhaserVoiceActionDispatcher,
} from '../voiceActionDispatcher.js'
import { executePhaserVoiceAction } from '../../scenes/phaserAttackHandler.js'
import { executePhaserAttack } from '../../scenes/phaserAttackHandler.js'
import { createGameStore } from '../../state/gameStore.js'

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

function voicePanelFixture() {
  const nodes = Object.fromEntries(['record', 'stop', 'cancel', 'status', 'detail', 'transcript',
    'dispatcherResult', 'rejectionReason']
    .map((name) => [name, new MockNode()]))
  const selectors = {
    '[data-voice-record]': nodes.record,
    '[data-voice-stop]': nodes.stop,
    '[data-voice-cancel]': nodes.cancel,
    '[data-voice-status]': nodes.status,
    '[data-voice-detail]': nodes.detail,
    '[data-voice-transcript]': nodes.transcript,
    '[data-voice-diagnostic="dispatcher-result"]': nodes.dispatcherResult,
    '[data-voice-diagnostic="rejection-reason"]': nodes.rejectionReason,
  }
  return { nodes, root: { querySelector: (selector) => selectors[selector] } }
}

function voiceIntent(action, parameters = {}) {
  return { version: 1, game: 'phaser-2d', action, parameters }
}

test('Phaser voice command path records, transcribes, uses Groq, and dispatches only the validated intent', async () => {
  const { nodes, root } = voicePanelFixture()
  const events = []
  const store = createGameStore({ classId: 'warrior', name: 'Voice Flow' })
  store.recoverRelic()
  const gameScene = {
    store,
    player: { x: 200, y: 280 },
    sentinel: { x: 658, y: 280, setVisible() {} },
    sentinelBody: { setAlpha() {} },
    sentinelAura: { destroy() {} },
    sentinelLabel: { setVisible() {} },
    time: { now: 1000, delayedCall() {} },
    lastAttack: 580,
    audio: { play() {} },
    onMessage() {},
    cameras: { main: { shake() {} } },
    canExecuteVoiceAction(action) {
      return action === 'light_attack' && canExecutePhaserVoiceAttack({
        state: store.getState(),
        player: this.player,
        sentinel: this.sentinel,
        now: this.time.now,
        lastAttack: this.lastAttack,
      })
    },
    getVoiceActionRejectionReason(action) {
      const state = store.getState()
      if (action === 'light_attack' && (!state.objectives.relic || state.sentinelHealth <= 0)) return 'No active enemies found.'
      return 'The action is unavailable.'
    },
    attack(options) { return executePhaserAttack(this, options) },
  }
  gameScene.executeVoiceAction = (action) => executePhaserVoiceAction(gameScene, action)
  let observedSentinelHealth = store.getState().sentinelHealth
  let diagnosticStatusAtDefeat
  store.subscribe((state) => {
    if (state.sentinelHealth < observedSentinelHealth) {
      events.push('game-action')
      if (state.sentinelHealth === 0) diagnosticStatusAtDefeat = nodes.dispatcherResult.textContent
    }
    observedSentinelHealth = state.sentinelHealth
  })
  const dispatcher = createPhaserVoiceActionDispatcher(gameScene)
  let speechCount = 0
  const fetchImpl = async (url, options = {}) => {
    events.push(url)
    if (url === '/api/health') return Response.json({ configured: true, groq: { configured: true }, evon: { configured: false } })
    if (url === '/api/voice/transcribe') {
      assert.equal(options.headers['Content-Type'], 'audio/wav')
      return Response.json({ transcript: 'Attack the enemy', detectedLanguageCode: 'en-IN' })
    }
    if (url === '/api/voice/interpret') {
      assert.deepEqual(JSON.parse(options.body), { transcript: 'Attack the enemy', game: 'phaser-2d' })
      // Explicit mocked Groq response fixture; no live model response is implied by this test.
      return Response.json({ intent: voiceIntent('light_attack') })
    }
    if (url === '/api/voice/speak') {
      const body = JSON.parse(options.body)
      speechCount += 1
      if (speechCount === 1) assert.match(body.text, /accepted the light attack command/)
      else assert.match(body.text, /rejected that action: No active enemies found/)
      return new Response(new Uint8Array([82, 73, 70, 70]), { headers: { 'content-type': 'audio/wav' } })
    }
    throw new Error(`Unexpected request: ${url}`)
  }
  let playedAudio
  const controller = createVoiceController(root, {
    game: 'phaser-2d',
    recorderFactory: () => ({
      async start() {
        events.push('microphone-start')
        return { stop: async () => new Blob(['recorded wav'], { type: 'audio/wav' }), cancel: async () => {} }
      },
    }),
    prisma: createPrismaAdapter({ fetchImpl }),
    timbre: createTimbreAdapter({ fetchImpl }),
    fetchImpl,
    play: async (audio) => { events.push('audio-play'); playedAudio = audio },
    onIntent: (proposal) => dispatcher.dispatch(proposal),
  })

  await nodes.record.click()
  assert.equal(nodes.status.textContent, 'Listening')
  await nodes.stop.click()

  assert.equal(nodes.transcript.textContent, '')
  assert.match(nodes.detail.textContent, /Groq interpreted the command/)
  assert.equal(playedAudio.type, 'audio/wav')
  assert.equal(events.includes('game-action'), true, 'the validated Groq intent reaches the existing scene dispatcher')
  assert.equal(store.getState().sentinelHealth, observedSentinelHealth)
  assert.equal(store.getState().sentinelHealth, 0)
  assert.equal(store.getState().objectives.sentinel, true)
  assert.equal(store.getState().health, 120, 'the actual attack handler must leave player health unchanged')
  assert.equal(nodes.dispatcherResult.textContent, 'ACCEPTED')
  assert.equal(diagnosticStatusAtDefeat, 'PROCESSING', 'ACCEPTED is delayed until actual defeat is committed')
  assert.equal(nodes.rejectionReason.textContent, 'None')
  await nodes.record.click()
  await nodes.stop.click()
  assert.equal(nodes.dispatcherResult.textContent, 'REJECTED')
  assert.equal(nodes.rejectionReason.textContent, 'No active enemies found.')
  assert.equal(store.getState().sentinelHealth, 0, 'the rejected second command does not execute another hit')
  assert.ok(events.indexOf('/api/voice/transcribe') < events.indexOf('/api/voice/speak'))
  assert.ok(events.indexOf('/api/voice/interpret') < events.indexOf('game-action'))
  assert.ok(events.indexOf('/api/voice/speak') < events.indexOf('audio-play'))
  controller.destroy()
})

test('Phaser interact_nearest completes the mocked provider flow only for a nearby target', async () => {
  const { nodes, root } = voicePanelFixture()
  const events = []
  let nearbyTarget = true
  let interactionCount = 0
  const scene = {
    canExecuteVoiceAction(action) { return action === 'interact_nearest' && nearbyTarget },
    interact() {
      interactionCount += 1
      nearbyTarget = false
      events.push('game-action')
      return true
    },
  }
  scene.executeVoiceAction = (action) => executePhaserVoiceAction(scene, action)
  const dispatcher = createPhaserVoiceActionDispatcher(scene)
  const fetchImpl = async (url, options = {}) => {
    events.push(url)
    if (url === '/api/health') return Response.json({ configured: true, groq: { configured: true } })
    if (url === '/api/voice/transcribe') return Response.json({ transcript: 'Interact with the Sun Relic', detectedLanguageCode: 'en-IN' })
    if (url === '/api/voice/interpret') return Response.json({ intent: voiceIntent('interact_nearest') })
    if (url === '/api/voice/speak') {
      assert.match(JSON.parse(options.body).text, /accepted the interact nearest command/)
      return new Response(new Uint8Array([82, 73, 70, 70]), { headers: { 'content-type': 'audio/wav' } })
    }
    throw new Error(`Unexpected request: ${url}`)
  }
  let playedAudio
  const controller = createVoiceController(root, {
    game: 'phaser-2d',
    recorderFactory: () => ({ async start() { return { stop: async () => new Blob(['recorded wav']), cancel: async () => {} } } }),
    prisma: createPrismaAdapter({ fetchImpl }),
    groq: createGroqAdapter({ fetchImpl }),
    timbre: createTimbreAdapter({ fetchImpl }),
    fetchImpl,
    play: async (audio) => { events.push('audio-play'); playedAudio = audio },
    onIntent: (proposal) => dispatcher.dispatch(proposal),
  })

  await nodes.record.click()
  await nodes.stop.click()

  assert.equal(nodes.transcript.textContent, '')
  assert.equal(interactionCount, 1)
  assert.equal(playedAudio.type, 'audio/wav')
  assert.ok(events.indexOf('/api/voice/transcribe') < events.indexOf('/api/voice/interpret'))
  assert.ok(events.indexOf('/api/voice/interpret') < events.indexOf('game-action'))
  assert.ok(events.indexOf('game-action') < events.indexOf('/api/voice/speak'))
  assert.ok(events.indexOf('/api/voice/speak') < events.indexOf('audio-play'))

  const rejected = dispatcher.dispatch(voiceIntent('interact_nearest'))
  assert.equal(rejected.ok, false, 'the consumed relic is no longer a valid nearby interaction target')
  assert.equal(interactionCount, 1, 'a rejected interaction must not execute the game handler')
  controller.destroy()
})

test('Phaser voice dispatcher rejects cooldown, inactive mission, and unavailable actions but ignores distance', () => {
  const context = {
    state: { status: 'active', sentinelHealth: 90, objectives: { relic: true } },
    player: { x: 600, y: 280 }, sentinel: { x: 658, y: 280 }, now: 1000, lastAttack: 581,
  }
  let executed = 0
  const scene = {
    canExecuteVoiceAction(action) {
      return action === 'light_attack' && canExecutePhaserVoiceAttack(context)
    },
    executeVoiceAction() { executed += 1; return true },
  }
  const dispatcher = createPhaserVoiceActionDispatcher(scene)
  assert.equal(dispatcher.dispatch(voiceIntent('light_attack')).ok, false, 'cooldown blocks the action')
  context.lastAttack = 580
  context.player = { x: 400, y: 280 }
  assert.equal(dispatcher.dispatch(voiceIntent('light_attack')).ok, true, 'distance does not block an active enemy')
  context.player = { x: 600, y: 280 }
  context.state = { ...context.state, status: 'defeat' }
  assert.equal(dispatcher.dispatch(voiceIntent('light_attack')).ok, false, 'inactive mission blocks the action')
  context.state = { ...context.state, status: 'active', sentinelHealth: 0 }
  assert.equal(dispatcher.dispatch(voiceIntent('light_attack')).ok, false, 'defeated enemy blocks the action')
  assert.equal(dispatcher.dispatch(voiceIntent('heavy_attack')).ok, false, 'unsupported action is rejected')
  assert.equal(dispatcher.dispatch({ ...voiceIntent('light_attack'), parameters: { damage: 999 } }).ok, false)
  assert.equal(executed, 1, 'only the distant, otherwise-valid light attack reaches the handler')
})
