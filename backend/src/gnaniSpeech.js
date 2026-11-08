const GNANI_BASE_URL = 'https://api.vachana.ai'

export async function transcribeAudio(audio, { apiKey, fetchImpl = fetch, requestId }) {
  if (!apiKey) throw new Error('Gnani API key is not configured.')
  const form = new FormData()
  form.append('audio_file', new Blob([audio], { type: 'audio/wav' }), 'recording.wav')
  form.append('model', 'prisma-v3.0')
  // Prefer English while Prisma still detects and returns clearly spoken Malayalam.
  form.append('language_code', 'en-IN')
  form.append('format', 'transcribe')

  const response = await fetchImpl(`${GNANI_BASE_URL}/stt/v3`, {
    method: 'POST',
    headers: {
      'X-API-Key-ID': apiKey,
      ...(requestId ? { 'X-API-Request-ID': requestId } : {}),
    },
    body: form,
    signal: AbortSignal.timeout(60_000),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok || result.success !== true) {
    const error = new Error(result.error?.message || result.message || 'Prisma transcription failed.')
    error.status = response.status
    error.providerErrorType = result.error?.type ?? result.error?.code ?? null
    error.providerStatusCode = result.status_code ?? result.error?.status_code ?? null
    error.requestId = result.request_id ?? requestId ?? null
    throw error
  }
  return result
}

export async function synthesizeSpeech(text, {
  apiKey,
  fetchImpl = fetch,
  voice = 'Shivani',
  language = 'auto',
}) {
  if (!apiKey) throw new Error('Gnani API key is not configured.')
  const response = await fetchImpl(`${GNANI_BASE_URL}/api/v1/tts/inference`, {
    method: 'POST',
    headers: {
      'X-API-Key-ID': apiKey,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      text,
      voice,
      model: 'timbre-v3.0',
      language,
      speed: 1,
      audio_config: {
        encoding: 'linear_pcm',
        container: 'wav',
        num_channels: 1,
        sample_rate: 48000,
        sample_width: 2,
      },
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!response.ok) {
    const details = await response.json().catch(() => ({}))
    const error = new Error(details.message || details.detail?.message || 'Timbre synthesis failed.')
    error.status = response.status
    throw error
  }
  return Buffer.from(await response.arrayBuffer())
}
