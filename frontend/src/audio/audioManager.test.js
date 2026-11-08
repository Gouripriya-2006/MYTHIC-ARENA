import assert from 'node:assert/strict'
import test from 'node:test'
import { createAudioManager, renderAudioSettings } from './audioManager.js'

class FakeAudioParam {
  value = 0

  setTargetAtTime(value) {
    this.value = value
  }

  setValueAtTime(value) {
    this.value = value
  }

  exponentialRampToValueAtTime(value) {
    this.value = value
  }
}

class FakeAudioNode {
  constructor() {
    this.gain = new FakeAudioParam()
    this.frequency = new FakeAudioParam()
    this.connections = []
  }

  connect(node) {
    this.connections.push(node)
  }

  disconnect() {}

  start() {}

  stop() {}
}

class FakeAudioContext {
  currentTime = 0
  state = 'suspended'
  destination = new FakeAudioNode()
  gains = []
  oscillators = []
  bufferSources = []

  createGain() {
    const node = new FakeAudioNode()
    this.gains.push(node)
    return node
  }

  createOscillator() {
    const node = new FakeAudioNode()
    this.oscillators.push(node)
    return node
  }

  createBufferSource() {
    const node = new FakeAudioNode()
    node.start = () => queueMicrotask(() => node.onended?.())
    this.bufferSources.push(node)
    return node
  }

  async decodeAudioData() {
    return { duration: 1 }
  }

  async resume() {
    this.state = 'running'
  }

  async close() {
    this.state = 'closed'
  }
}

function createStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

function createTimers() {
  let nextId = 0
  const scheduled = new Map()
  return {
    scheduled,
    setTimeout(callback) {
      const id = ++nextId
      scheduled.set(id, callback)
      return id
    },
    clearTimeout(id) {
      scheduled.delete(id)
    },
  }
}

test('creates the Web Audio context only after an explicit unlock and deduplicates music', async () => {
  const contexts = []
  const timers = createTimers()
  const audio = createAudioManager({
    contextFactory: () => {
      const context = new FakeAudioContext()
      contexts.push(context)
      return context
    },
    storage: createStorage(),
    timers,
  })

  audio.playMusic('realm')
  assert.equal(contexts.length, 0)
  assert.deepEqual(audio.getStatus(), { unlocked: false, musicTrack: 'realm', muted: false })

  assert.equal(await audio.unlock(), true)
  assert.equal(contexts.length, 1)
  assert.equal(contexts[0].oscillators.length, 3)
  assert.equal(timers.scheduled.size, 1)
  assert.equal(audio.playMusic('realm'), false)
  assert.equal(contexts[0].oscillators.length, 3)
  assert.equal(timers.scheduled.size, 1)
})

test('mixes music and effects through separate volume controls and honors mute', async () => {
  const context = new FakeAudioContext()
  const timers = createTimers()
  let now = 1000
  const audio = createAudioManager({
    contextFactory: () => context,
    storage: createStorage(),
    timers,
    now: () => now,
  })

  audio.updateSettings({ master: 0.6, music: 0.4, effects: 0.25, muted: false })
  audio.playMusic('realm')
  await audio.unlock()
  assert.equal(context.gains[0].gain.value, 0.6)
  assert.equal(context.gains[1].gain.value, 0.4)
  assert.equal(context.gains[2].gain.value, 0.25)

  assert.equal(audio.play('player-heavy'), true)
  const oscillatorCount = context.oscillators.length
  assert.equal(audio.play('player-heavy'), false)
  assert.equal(context.oscillators.length, oscillatorCount)

  now += 100
  audio.updateSettings({ master: 0.6, music: 0.4, effects: 0.25, muted: true })
  assert.equal(context.gains[0].gain.value, 0)
  assert.equal(timers.scheduled.size, 0)
  assert.equal(audio.play('player-light'), false)

  audio.updateSettings({ master: 0.6, music: 0.4, effects: 0.25, muted: false })
  assert.equal(context.gains[0].gain.value, 0.6)
  assert.equal(timers.scheduled.size, 1)
})

test('persists validated preferences and restores them in a new manager', () => {
  const storage = createStorage()
  const audio = createAudioManager({ contextFactory: () => new FakeAudioContext(), storage })
  audio.updateSettings({ master: 1.4, music: -1, effects: 0.45, muted: true })

  assert.deepEqual(audio.getSettings(), { master: 1, music: 0, effects: 0.45, muted: true })
  const restored = createAudioManager({ contextFactory: () => new FakeAudioContext(), storage })
  assert.deepEqual(restored.getSettings(), audio.getSettings())
})

test('renders settings that control master, music, effects, and mute', () => {
  const markup = renderAudioSettings({ master: 0.6, music: 0.3, effects: 0.5, muted: true })
  assert.match(markup, /data-setting="master"/)
  assert.match(markup, /data-setting="music"/)
  assert.match(markup, /data-setting="effects"/)
  assert.match(markup, /data-setting="muted" checked/)
  assert.match(markup, /SFX volume/)
})

test('plays synthesized audio through the shared master channel and supports cancellation', async () => {
  const context = new FakeAudioContext()
  const audio = createAudioManager({ contextFactory: () => context, storage: createStorage() })
  await audio.unlock()
  assert.equal(await audio.playAudioBlob(new Blob(['wav'])), true)
  assert.equal(context.bufferSources[0].connections[0], context.gains[0])

  const controller = new AbortController()
  const playback = audio.playAudioBlob(new Blob(['wav']), { signal: controller.signal })
  controller.abort()
  assert.equal(await playback, false)
})
