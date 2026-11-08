const TARGET_SAMPLE_RATE = 16_000
const MAX_RECORDING_SECONDS = 30

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)
  const writeText = (offset, value) => {
    for (let index = 0; index < value.length; index += 1) view.setUint8(offset + index, value.charCodeAt(index))
  }
  writeText(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeText(8, 'WAVE')
  writeText(12, 'fmt ')
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, 1, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, sampleRate * 2, true)
  view.setUint16(32, 2, true)
  view.setUint16(34, 16, true)
  writeText(36, 'data')
  view.setUint32(40, samples.length * 2, true)
  let offset = 44
  for (const sample of samples) {
    const clipped = Math.max(-1, Math.min(1, sample))
    view.setInt16(offset, clipped < 0 ? clipped * 0x8000 : clipped * 0x7fff, true)
    offset += 2
  }
  return new Blob([buffer], { type: 'audio/wav' })
}

function downsample(chunks, sourceRate) {
  const sourceLength = chunks.reduce((total, chunk) => total + chunk.length, 0)
  const source = new Float32Array(sourceLength)
  let position = 0
  chunks.forEach((chunk) => { source.set(chunk, position); position += chunk.length })
  const outputLength = Math.floor(sourceLength * TARGET_SAMPLE_RATE / sourceRate)
  const output = new Float32Array(outputLength)
  const ratio = sourceRate / TARGET_SAMPLE_RATE
  for (let index = 0; index < outputLength; index += 1) {
    const start = Math.floor(index * ratio)
    const end = Math.min(Math.floor((index + 1) * ratio), sourceLength)
    let sum = 0
    for (let sample = start; sample < end; sample += 1) sum += source[sample]
    output[index] = sum / Math.max(1, end - start)
  }
  return output
}

export function createMicrophoneRecorder({
  mediaDevices = globalThis.navigator?.mediaDevices,
  audioContextFactory = () => new (globalThis.AudioContext || globalThis.webkitAudioContext)(),
  maxDurationSeconds = MAX_RECORDING_SECONDS,
} = {}) {
  let stream
  let context
  let source
  let processor
  let silentGain
  let chunks = []
  let timer
  let settled = false

  async function cleanup() {
    if (timer) clearTimeout(timer)
    processor?.disconnect()
    source?.disconnect()
    silentGain?.disconnect()
    stream?.getTracks().forEach((track) => track.stop())
    if (context && context.state !== 'closed') await context.close()
    stream = context = source = processor = silentGain = undefined
  }

  return {
    async start(onLimit) {
      if (!mediaDevices?.getUserMedia) throw new Error('Microphone access is unavailable in this browser.')
      try {
      stream = await mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true } })
      context = audioContextFactory()
      await context.resume()
      source = context.createMediaStreamSource(stream)
      processor = context.createScriptProcessor(4096, 1, 1)
      silentGain = context.createGain()
      silentGain.gain.value = 0
      chunks = []
      settled = false
      processor.onaudioprocess = (event) => chunks.push(new Float32Array(event.inputBuffer.getChannelData(0)))
      source.connect(processor)
      processor.connect(silentGain)
      silentGain.connect(context.destination)

      const stop = async () => {
        if (settled) return null
        settled = true
        const audio = encodeWav(downsample(chunks, context.sampleRate), TARGET_SAMPLE_RATE)
        await cleanup()
        chunks = []
        return audio
      }
      const cancel = async () => {
        if (settled) return
        settled = true
        chunks = []
        await cleanup()
      }
      timer = setTimeout(async () => {
        const audio = await stop()
        onLimit?.(audio)
      }, maxDurationSeconds * 1000)
      return { stop, cancel }
      } catch (error) {
        await cleanup()
        throw error
      }
    },
  }
}
