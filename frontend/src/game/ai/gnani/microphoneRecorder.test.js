import test from 'node:test'
import assert from 'node:assert/strict'
import { createMicrophoneRecorder } from './microphoneRecorder.js'

test('microphone recorder releases tracks and returns mono PCM WAV at 16 kHz', async () => {
  const track = { stopped: false, stop() { this.stopped = true } }
  const processor = { connect() {}, disconnect() {}, onaudioprocess: null }
  const source = { connect() {}, disconnect() {} }
  const gain = { gain: {}, connect() {}, disconnect() {} }
  const context = {
    sampleRate: 48_000,
    state: 'running',
    destination: {},
    async resume() {},
    async close() { this.state = 'closed' },
    createMediaStreamSource() { return source },
    createScriptProcessor() { return processor },
    createGain() { return gain },
  }
  const recorder = createMicrophoneRecorder({
    mediaDevices: { async getUserMedia() { return { getTracks: () => [track] } } },
    audioContextFactory: () => context,
  })
  const session = await recorder.start()
  processor.onaudioprocess({ inputBuffer: { getChannelData: () => new Float32Array(4800).fill(0.25) } })
  const wav = await session.stop()
  const bytes = new Uint8Array(await wav.arrayBuffer())
  const view = new DataView(bytes.buffer)
  assert.equal(wav.type, 'audio/wav')
  assert.equal(String.fromCharCode(...bytes.slice(0, 4)), 'RIFF')
  assert.equal(view.getUint32(24, true), 16_000)
  assert.equal(view.getUint16(22, true), 1)
  assert.equal(bytes.length, 44 + 1600 * 2)
  assert.equal(track.stopped, true)
  assert.equal(context.state, 'closed')
})
