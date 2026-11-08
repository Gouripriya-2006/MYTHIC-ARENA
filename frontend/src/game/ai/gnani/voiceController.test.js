import test from 'node:test'
import assert from 'node:assert/strict'
import { createVoiceController } from './voiceController.js'
import { createPrismaAdapter } from './prismaAdapter.js'
import { createTimbreAdapter } from './timbreAdapter.js'
import { createGroqAdapter } from './groqAdapter.js'
import { renderVoicePanel } from '../../ui/VoicePanel.js'

class MockNode {
  textContent = ''
  hidden = false
  disabled = false
  dataset = {}
  listeners = new Map()

  addEventListener(type, listener) {
    this.listeners.set(type, listener)
  }

  removeEventListener(type) {
    this.listeners.delete(type)
  }

  async click() {
    return this.listeners.get('click')?.()
  }
}

function createFixture(options = {}) {
  const nodes = Object.fromEntries([
    'record', 'stop', 'cancel', 'status', 'detail', 'transcript',
    'recognizedIntent', 'validatedIntent', 'dispatcherResult', 'rejectionReason', 'lastActionStatus',
  ].map((key) => [key, new MockNode()]))
  for (const provider of ['prisma', 'groq', 'timbre']) {
    nodes[provider] = new MockNode()
    nodes[`${provider}Value`] = new MockNode()
    nodes[provider].querySelector = () => nodes[`${provider}Value`]
  }
  const selectors = {
    '[data-voice-record]': nodes.record,
    '[data-voice-stop]': nodes.stop,
    '[data-voice-cancel]': nodes.cancel,
    '[data-voice-status]': nodes.status,
    '[data-voice-detail]': nodes.detail,
    '[data-voice-transcript]': nodes.transcript,
    '[data-voice-diagnostic="recognized-intent"]': nodes.recognizedIntent,
    '[data-voice-diagnostic="validated-intent"]': nodes.validatedIntent,
    '[data-voice-diagnostic="dispatcher-result"]': nodes.dispatcherResult,
    '[data-voice-diagnostic="rejection-reason"]': nodes.rejectionReason,
    '[data-voice-diagnostic="last-action-status"]': nodes.lastActionStatus,
    '[data-voice-provider="prisma"]': nodes.prisma,
    '[data-voice-provider="groq"]': nodes.groq,
    '[data-voice-provider="timbre"]': nodes.timbre,
  }
  const root = { querySelector: (selector) => selectors[selector] }
  const controller = createVoiceController(root, {
    fetchImpl: async () => Response.json({ configured: true, groq: { configured: true } }),
    ...options,
  })
  return { nodes, controller }
}

function fakeRecorder(onCreated = () => {}) {
  return {
    async start(onLimit) {
      const session = {
        onLimit,
        async stop() { return new Blob(['wav'], { type: 'audio/wav' }) },
        async cancel() { session.cancelled = true },
      }
      onCreated(session)
      return session
    },
  }
}

test('voice setup status checks Groq configuration from backend health', async () => {
  const missingGroq = createFixture({
    fetchImpl: async () => Response.json({ configured: true, groq: { configured: false } }),
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(missingGroq.nodes.status.textContent, 'Setup needed')
  assert.match(missingGroq.nodes.detail.textContent, /GROQ_API_KEY/)
  missingGroq.controller.destroy()

  const ready = createFixture({
    fetchImpl: async () => Response.json({ configured: true, groq: { configured: true } }),
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(ready.nodes.status.textContent, 'Ready')
  assert.match(ready.nodes.detail.textContent, /Prisma, Groq, and Timbre/)
  assert.deepEqual([ready.nodes.prisma.dataset.state, ready.nodes.groq.dataset.state, ready.nodes.timbre.dataset.state], ['ready', 'ready', 'ready'])
  ready.controller.destroy()

  const missingGnani = createFixture({ fetchImpl: async () => Response.json({ configured: false, groq: { configured: true } }) })
  await new Promise((resolve) => setImmediate(resolve))
  assert.deepEqual([missingGnani.nodes.prisma.dataset.state, missingGnani.nodes.groq.dataset.state, missingGnani.nodes.timbre.dataset.state], ['setup-needed', 'ready', 'setup-needed'])
  missingGnani.controller.destroy()
})

test('Phaser voice panel names active providers and includes temporary diagnostic fields', () => {
  const panel = renderVoicePanel({ diagnostics: true, showTranscript: false })
  for (const provider of ['prisma', 'groq', 'timbre']) assert.match(panel, new RegExp(`data-voice-provider="${provider}"`))
  assert.match(panel, /TEMPORARY VOICE DIAGNOSTICS/)
  for (const field of ['recognized-intent', 'validated-intent', 'dispatcher-result', 'rejection-reason', 'last-action-status']) {
    assert.match(panel, new RegExp(`data-voice-diagnostic="${field}"`))
  }
  assert.doesNotMatch(panel, /GEMINI/)
  assert.doesNotMatch(panel, /data-voice-transcript|RECOGNIZED SPEECH/)
  assert.match(panel, /Dispatcher status/)
  assert.match(panel, /Action result/)
  assert.doesNotMatch(renderVoicePanel(), /data-voice-diagnostics/)
})

test('voice input transcribes, asks Groq for a validated intent, dispatches it, and speaks via Timbre', async () => {
  let synthesized
  let heardMessage
  let played
  const fixture = createFixture({
    game: 'phaser-2d',
    recorderFactory: () => fakeRecorder(),
    prisma: { async transcribe() { return { transcript: 'Find the Sun Relic', detectedLanguageCode: 'en-IN' } } },
    groq: { async interpret(transcript, game) {
      assert.equal(transcript, 'Find the Sun Relic')
      assert.equal(game, 'phaser-2d')
      return { intent: { version: 1, game, action: 'light_attack', parameters: {} } }
    } },
    timbre: { async synthesize(text, options) { synthesized = { text, options }; return new Blob(['speech']) } },
    play: async (audio) => { played = audio },
    onMessage: (message) => { heardMessage = message },
    onIntent: (intent) => ({ ok: true, intent }),
  })
  await fixture.nodes.record.click()
  assert.equal(fixture.nodes.status.textContent, 'Listening')
  await fixture.nodes.stop.click()
  assert.equal(fixture.nodes.transcript.textContent, '')
  assert.match(synthesized.text, /I heard you say: Find the Sun Relic/)
  assert.match(synthesized.text, /accepted the light attack command/)
  assert.equal(synthesized.options.language, 'en-IN')
  assert.equal(played instanceof Blob, true)
  assert.equal(heardMessage, 'Game action accepted: light_attack')
  assert.equal(fixture.nodes.status.textContent, 'Ready')
  assert.equal(fixture.nodes.record.disabled, false)
  assert.equal(fixture.nodes.recognizedIntent.textContent, 'light_attack')
  assert.equal(fixture.nodes.validatedIntent.textContent, '{"version":1,"game":"phaser-2d","action":"light_attack","parameters":{}}')
  assert.equal(fixture.nodes.dispatcherResult.textContent, 'ACCEPTED')
  assert.equal(fixture.nodes.rejectionReason.textContent, 'None')
  assert.equal(fixture.nodes.lastActionStatus.textContent, 'Executed successfully.')
  fixture.controller.destroy()
})

test('voice action rejection is reported and Timbre voices that the game cannot perform it', async () => {
  let synthesized
  let heardMessage
  const fixture = createFixture({
    game: 'phaser-2d',
    recorderFactory: () => fakeRecorder(),
    prisma: { async transcribe() { return { transcript: 'private transcript omitted from diagnostics', detectedLanguageCode: 'en-IN' } } },
    groq: { async interpret() { return { intent: { version: 1, game: 'phaser-2d', action: 'light_attack', parameters: {} } } } },
    onIntent: () => ({
      ok: false,
      error: 'That action is not available in the current game state.',
      intent: { action: 'light_attack' },
    }),
    onMessage: (message) => { heardMessage = message },
    timbre: { async synthesize(text) { synthesized = text; return new Blob(['speech']) } },
    play: async () => {},
  })
  await fixture.nodes.record.click()
  await fixture.nodes.stop.click()
  assert.equal(heardMessage, 'That action is not available in the current game state.')
  assert.match(synthesized, /The game rejected that action/)
  assert.equal(fixture.nodes.recognizedIntent.textContent, 'light_attack')
  assert.equal(fixture.nodes.validatedIntent.textContent, '{"action":"light_attack","parameters":{}}')
  assert.equal(fixture.nodes.dispatcherResult.textContent, 'REJECTED')
  assert.equal(fixture.nodes.rejectionReason.textContent, 'That action is not available in the current game state.')
  assert.match(fixture.nodes.lastActionStatus.textContent, /^Not executed:/)
  const diagnosticValues = Object.values(fixture.nodes).filter((node) => node !== fixture.nodes.transcript).map((node) => node.textContent)
  assert.equal(diagnosticValues.some((value) => value.includes('private transcript')), false)
  fixture.controller.destroy()
})

test('recognized speech stays visible and PROCESSING persists until Babylon confirms the attack result', async () => {
  let completeAction
  const intent = { version: 1, game: 'babylon-3d', action: 'light_attack', parameters: {} }
  const fixture = createFixture({
    game: 'babylon-3d',
    recorderFactory: () => fakeRecorder(),
    prisma: { async transcribe() { return { transcript: 'Attack the Goblin.', detectedLanguageCode: 'en-IN' } } },
    groq: { async interpret() { return { intent } } },
    onIntent: (validated) => new Promise((resolve) => {
      assert.deepEqual(validated, intent)
      completeAction = resolve
    }),
    timbre: { async synthesize() { return new Blob(['speech']) } },
    play: async () => {},
  })
  await fixture.nodes.record.click()
  const completion = fixture.nodes.stop.click()
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(fixture.nodes.transcript.textContent, 'Attack the Goblin.')
  assert.equal(fixture.nodes.dispatcherResult.textContent, 'PROCESSING')
  assert.equal(fixture.nodes.lastActionStatus.textContent, 'PROCESSING')
  assert.equal(fixture.nodes.recognizedIntent.textContent, 'light_attack')
  completeAction({ ok: true, intent, actionResult: 'Goblin Warrior HP: 72 → 38.' })
  await completion
  assert.equal(fixture.nodes.dispatcherResult.textContent, 'ACCEPTED')
  assert.equal(fixture.nodes.validatedIntent.textContent, '{"version":1,"game":"babylon-3d","action":"light_attack","parameters":{}}')
  assert.equal(fixture.nodes.lastActionStatus.textContent, 'Goblin Warrior HP: 72 → 38.')
  fixture.controller.destroy()
})

test('provider failure marks dispatch as not attempted and keeps the normal voice error status', async () => {
  const fixture = createFixture({
    recorderFactory: () => fakeRecorder(),
    prisma: { async transcribe() { return { transcript: 'Do not place transcript in diagnostics' } } },
    groq: { async interpret() { throw new Error('Reasoning provider unavailable.') } },
  })
  await fixture.nodes.record.click()
  await fixture.nodes.stop.click()
  assert.equal(fixture.nodes.dispatcherResult.textContent, 'NOT ATTEMPTED')
  assert.equal(fixture.nodes.validatedIntent.textContent, 'Not attempted')
  assert.equal(fixture.nodes.lastActionStatus.textContent, 'NOT ATTEMPTED')
  assert.match(fixture.nodes.rejectionReason.textContent, /failed before dispatch/)
  assert.equal(fixture.nodes.status.textContent, 'Voice unavailable')
  assert.equal(fixture.nodes.detail.textContent, 'Reasoning provider unavailable.')
  assert.equal(fixture.nodes.recognizedIntent.textContent, 'Not available')
  const diagnosticValues = Object.values(fixture.nodes).filter((node) => node !== fixture.nodes.transcript).map((node) => node.textContent)
  assert.equal(diagnosticValues.some((value) => value.includes('Do not place transcript')), false)
  fixture.controller.destroy()
})

test('Phaser does not display full transcript text in its diagnostic UI or game message', async () => {
  const transcript = 'à´¨à´®à´¸àµà´•à´¾à´°à´‚, à´Žà´™àµà´™à´¨àµ†à´¯àµà´£àµà´Ÿàµ?'
  let lastMessage = ''
  const fixture = createFixture({
    game: 'phaser-2d',
    onMessage: (message) => { lastMessage = message },
    recorderFactory: () => fakeRecorder(),
    prisma: { async transcribe() { return { transcript, detectedLanguageCode: 'ml-IN' } } },
    groq: { async interpret() { return { intent: { version: 1, game: 'phaser-2d', action: 'interact_nearest', parameters: {} } } } },
    onIntent: (intent) => ({ ok: true, intent }),
    timbre: { async synthesize() { return new Blob(['speech']) } },
    play: async () => {},
  })
  await fixture.nodes.record.click()
  await fixture.nodes.stop.click()
  assert.equal(fixture.nodes.transcript.textContent, '')
  assert.equal(lastMessage.includes(transcript), false)
  assert.doesNotMatch(renderVoicePanel({ diagnostics: true, showTranscript: false }), /data-voice-transcript|RECOGNIZED SPEECH/)
  fixture.controller.destroy()
})

test('cancel during recording discards audio and releases the controls', async () => {
  let session
  let transcriptions = 0
  const fixture = createFixture({
    recorderFactory: () => fakeRecorder((value) => { session = value }),
    prisma: { async transcribe() { transcriptions += 1; return { transcript: 'ignored' } } },
    timbre: { async synthesize() { throw new Error('must not run') } },
  })
  await fixture.nodes.record.click()
  await fixture.nodes.cancel.click()
  assert.equal(session.cancelled, true)
  assert.equal(transcriptions, 0)
  assert.equal(fixture.nodes.status.textContent, 'Ready')
  assert.equal(fixture.nodes.record.disabled, false)
  fixture.controller.destroy()
})

test('microphone permission failures are explained in the panel', async () => {
  const fixture = createFixture({
    recorderFactory: () => ({ async start() { throw Object.assign(new Error('denied'), { name: 'NotAllowedError' }) } }),
  })
  await fixture.nodes.record.click()
  assert.equal(fixture.nodes.status.textContent, 'Voice unavailable')
  assert.match(fixture.nodes.detail.textContent, /Microphone permission was denied/)
  fixture.controller.destroy()
})

test('Prisma frontend adapter sends WAV to the same-origin backend', async () => {
  let request
  const adapter = createPrismaAdapter({
    fetchImpl: async (url, options) => { request = { url, options }; return Response.json({ transcript: 'hello' }) },
  })
  const result = await adapter.transcribe(new Blob(['audio'], { type: 'audio/wav' }))
  assert.equal(request.url, '/api/voice/transcribe')
  assert.equal(request.options.headers['Content-Type'], 'audio/wav')
  assert.equal(result.transcript, 'hello')
})

test('Timbre frontend adapter receives binary audio and surfaces backend errors', async () => {
  const adapter = createTimbreAdapter({
    fetchImpl: async () => new Response(new Uint8Array([1, 2]), { headers: { 'content-type': 'audio/wav' } }),
  })
  const audio = await adapter.synthesize('A truthful response')
  assert.equal(audio.type, 'audio/wav')
  const failing = createTimbreAdapter({ fetchImpl: async () => Response.json({ error: 'voice unavailable' }, { status: 502 }) })
  await assert.rejects(failing.synthesize('Hello'), /voice unavailable/)
})

test('Groq frontend adapter sends transcript and game to the same-origin backend and surfaces errors', async () => {
  let request
  const adapter = createGroqAdapter({ fetchImpl: async (url, options) => {
    request = { url, options }
    return Response.json({ intent: { version: 1, game: 'babylon-3d', action: 'heavy_attack', parameters: {} } })
  } })
  const result = await adapter.interpret('Strike hard', 'babylon-3d')
  assert.equal(request.url, '/api/voice/interpret')
  assert.deepEqual(JSON.parse(request.options.body), { transcript: 'Strike hard', game: 'babylon-3d' })
  assert.equal(result.intent.action, 'heavy_attack')
  const failing = createGroqAdapter({ fetchImpl: async () => Response.json({ error: 'intent rejected' }, { status: 422 }) })
  await assert.rejects(failing.interpret('teleport', 'phaser-2d'), /intent rejected/)
})
