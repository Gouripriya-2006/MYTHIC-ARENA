import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { transcribeAudio, synthesizeSpeech } from './src/gnaniSpeech.js'
import { interpretTranscript } from './src/groqReasoning.js'
import { validateVoiceIntent } from '../shared/voiceIntent.js'

const MAX_AUDIO_BYTES = 8 * 1024 * 1024
const MAX_TEXT_LENGTH = 1000
const ALLOWED_LANGUAGES = new Set([
  'auto', 'hi-IN', 'en-IN', 'ta-IN', 'te-IN', 'kn-IN', 'ml-IN',
  'mr-IN', 'pa-IN', 'bn-IN', 'gu-IN', 'hi-en',
])

function sendJson(response, status, body) {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
  })
  response.end(JSON.stringify(body))
}

async function readBody(request, maxBytes) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxBytes) {
      const error = new Error('Request body is too large.')
      error.status = 413
      throw error
    }
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

function parseJson(buffer) {
  try {
    return JSON.parse(buffer.toString('utf8'))
  } catch {
    const error = new Error('Request body must be valid JSON.')
    error.status = 400
    throw error
  }
}

function publicProviderError(error) {
  if (error?.name === 'AbortError') return { status: 504, message: 'Gnani request timed out. Please try again.' }
  if (Number.isInteger(error?.status) && error.status >= 400 && error.status < 500) {
    return { status: error.status, message: error.message }
  }
  if (error?.status === 429) return { status: 429, message: 'Gnani is busy. Please wait a moment and try again.' }
  return { status: 502, message: 'Gnani voice service could not complete the request.' }
}

export function createAppServer({
  env = process.env,
  fetchImpl = globalThis.fetch,
  logger = console,
} = {}) {
  const apiKey = env.GNANI_API_KEY?.trim()
  const groqApiKey = env.GROQ_API_KEY?.trim()
  const groqModel = env.GROQ_MODEL?.trim() || 'openai/gpt-oss-20b'
  const providers = {
    transcribe: (audio, options) => transcribeAudio(audio, { apiKey, fetchImpl, ...options }),
    synthesize: (text, language) => synthesizeSpeech(text, {
      apiKey,
      fetchImpl,
      voice: env.GNANI_TIMBRE_VOICE || 'Shivani',
      language,
    }),
    interpret: (transcript, game) => interpretTranscript(transcript, game, {
      apiKey: groqApiKey,
      model: groqModel,
      fetchImpl,
    }),
  }

  return createServer(async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    if (request.method === 'OPTIONS') {
      response.writeHead(204, {
        'access-control-allow-origin': 'http://localhost:5173',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type',
      })
      response.end()
      return
    }

    if (request.method === 'GET' && url.pathname === '/api/health') {
      sendJson(response, 200, {
        ok: true,
        configured: Boolean(apiKey),
        groq: { configured: Boolean(groqApiKey), model: groqModel },
        evon: { configured: false, status: 'pending-official-api-verification' },
      })
      return
    }

    if (request.method === 'POST' && url.pathname === '/api/voice/intent/validate') {
      try {
        const validation = validateVoiceIntent(parseJson(await readBody(request, 2048)))
        if (!validation.ok) return sendJson(response, 400, { error: validation.error })
        return sendJson(response, 200, { intent: validation.intent })
      } catch (error) {
        return sendJson(response, error.status ?? 400, { error: error.message })
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/voice/interpret') {
      try {
        if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
          return sendJson(response, 415, { error: 'Send transcript and game as JSON.' })
        }
        const body = parseJson(await readBody(request, 8 * 1024))
        if (!body || typeof body !== 'object' || Array.isArray(body)
          || Object.keys(body).sort().join(',') !== 'game,transcript') {
          return sendJson(response, 400, { error: 'Provide only transcript and game.' })
        }
        if (typeof body.transcript !== 'string' || !body.transcript.trim()) {
          return sendJson(response, 400, { error: 'Transcript is required.' })
        }
        const intent = await providers.interpret(body.transcript, body.game)
        return sendJson(response, 200, { intent })
      } catch (error) {
        if (error.status === 413) return sendJson(response, 413, { error: error.message })
        if (error.providerDiagnostics) {
          logger.error?.('Groq request failed.', {
            event: 'groq_request_failed',
            ...error.providerDiagnostics,
          })
        }
        return sendJson(response, error.status ?? 502, {
          error: error.status === 400 || error.status === 413
            ? error.message
            : 'Voice intent interpretation failed safely. Please try again.',
        })
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/voice/transcribe') {
      let providerRequestId
      try {
        if (!apiKey) return sendJson(response, 503, { error: 'Gnani is not configured. Set GNANI_API_KEY in backend/.env.' })
        if (!request.headers['content-type']?.toLowerCase().startsWith('audio/wav')) {
          return sendJson(response, 415, { error: 'Upload a WAV audio recording.' })
        }
        const audio = await readBody(request, MAX_AUDIO_BYTES)
        if (audio.length < 44 || audio.toString('ascii', 0, 4) !== 'RIFF' || audio.toString('ascii', 8, 12) !== 'WAVE') {
          return sendJson(response, 400, { error: 'The recording is not a valid WAV file.' })
        }
        providerRequestId = randomUUID()
        const result = await providers.transcribe(audio, { requestId: providerRequestId })
        if (!result.transcript?.trim()) return sendJson(response, 422, { error: 'No speech was recognized. Please try again.' })
        return sendJson(response, 200, {
          transcript: result.transcript,
          detectedLanguageCode: result.detected_language_code ?? null,
          requestId: result.request_id ?? null,
        })
      } catch (error) {
        if (error.status === 413) return sendJson(response, 413, { error: error.message })
        const reportedRequestId = typeof error.requestId === 'string'
          && /^[A-Za-z0-9_-]{1,128}$/.test(error.requestId)
          ? error.requestId
          : null
        const requestId = reportedRequestId ?? providerRequestId ?? null
        const providerErrorType = typeof error.providerErrorType === 'string'
          && /^[A-Za-z0-9_-]{1,64}$/.test(error.providerErrorType)
          ? error.providerErrorType
          : null
        logger.error?.('Prisma transcription failed.', {
          event: 'prisma_transcription_failed',
          requestId,
          correlationId: providerRequestId ?? null,
          providerHttpStatus: Number.isInteger(error.status) ? error.status : null,
          providerStatusCode: Number.isInteger(error.providerStatusCode) ? error.providerStatusCode : null,
          providerErrorType,
        })
        const result = publicProviderError(error)
        return sendJson(response, result.status, {
          error: result.message,
          ...(requestId ? { requestId } : {}),
        })
      }
    }

    if (request.method === 'POST' && url.pathname === '/api/voice/speak') {
      try {
        if (!apiKey) return sendJson(response, 503, { error: 'Gnani is not configured. Set GNANI_API_KEY in backend/.env.' })
        const body = parseJson(await readBody(request, 16 * 1024))
        if (typeof body.text !== 'string' || !body.text.trim()) {
          return sendJson(response, 400, { error: 'Text to speak is required.' })
        }
        if (body.text.length > MAX_TEXT_LENGTH) {
          return sendJson(response, 413, { error: `Text must be ${MAX_TEXT_LENGTH} characters or fewer.` })
        }
        const language = body.language ?? 'auto'
        if (!ALLOWED_LANGUAGES.has(language)) {
          return sendJson(response, 400, { error: 'Unsupported Timbre language.' })
        }
        const audio = await providers.synthesize(body.text.trim(), language)
        response.writeHead(200, {
          'content-type': 'audio/wav',
          'content-length': audio.length,
          'cache-control': 'no-store',
          'x-content-type-options': 'nosniff',
        })
        response.end(audio)
        return
      } catch (error) {
        logger.error?.('Timbre synthesis failed.', error.message)
        const result = publicProviderError(error)
        return sendJson(response, result.status, { error: result.message })
      }
    }

    sendJson(response, 404, { error: 'Not found.' })
  })
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  const port = Number(process.env.PORT || 3001)
  createAppServer().listen(port, '127.0.0.1', () => {
    console.log(`MYTHIC ARENA voice backend listening on http://127.0.0.1:${port}`)
  })
}
