import { createMicrophoneRecorder } from './microphoneRecorder.js'
import { createPrismaAdapter } from './prismaAdapter.js'
import { createTimbreAdapter } from './timbreAdapter.js'
import { createGroqAdapter } from './groqAdapter.js'

function showStatus(root, status, detail) {
  const statusNode = root.querySelector('[data-voice-status]')
  const statusLabel = root.querySelector('[data-voice-status-label]')
  const detailNode = root.querySelector('[data-voice-detail]')
  if (statusNode) {
    if (statusLabel) statusLabel.textContent = status.toUpperCase()
    else statusNode.textContent = status
    statusNode.dataset.state = status.toLowerCase().replaceAll(' ', '-')
  }
  if (detailNode && detail !== undefined) detailNode.textContent = detail
}

function showProviderConfiguration(root, providers) {
  for (const [provider, configured] of Object.entries(providers)) {
    const node = root.querySelector(`[data-voice-provider="${provider}"]`)
    if (!node) continue
    const state = configured === true ? 'ready' : configured === false ? 'setup-needed' : configured === undefined ? 'checking' : 'unavailable'
    node.dataset.state = state
    const value = node.querySelector('b')
    if (value) value.textContent = state === 'ready' ? 'READY' : state === 'setup-needed' ? 'SETUP NEEDED' : state === 'checking' ? 'CHECKING' : 'OFFLINE'
  }
}

const DIAGNOSTIC_FIELDS = [
  'recognized-intent',
  'validated-intent',
  'dispatcher-result',
  'rejection-reason',
  'last-action-status',
]

function setDiagnostic(root, field, value) {
  const node = root.querySelector(`[data-voice-diagnostic="${field}"]`)
  if (node) {
    node.textContent = value
    node.dataset.state = typeof value === 'string' ? value.toLowerCase().replaceAll(' ', '-') : 'unknown'
  }
}

function diagnosticIntentName(intent) {
  if (typeof intent !== 'string') return 'Not available'
  const safeName = intent.replace(/[^a-z0-9_-]/gi, '').slice(0, 40)
  return safeName || 'Not available'
}

function diagnosticIntentJson(intent) {
  if (!intent || typeof intent !== 'object' || typeof intent.action !== 'string') return 'Not validated'
  return JSON.stringify({
    version: intent.version,
    game: intent.game,
    action: diagnosticIntentName(intent.action),
    parameters: intent.parameters && typeof intent.parameters === 'object' ? intent.parameters : {},
  })
}

function resetDiagnostics(root) {
  const values = ['Not available', 'Not attempted', 'NOT ATTEMPTED', 'None', 'NOT ATTEMPTED']
  DIAGNOSTIC_FIELDS.forEach((field, index) => setDiagnostic(root, field, values[index]))
}

function playAudio(blob, AudioConstructor = globalThis.Audio) {
  const url = URL.createObjectURL(blob)
  const audio = new AudioConstructor(url)
  audio.addEventListener('ended', () => URL.revokeObjectURL(url), { once: true })
  audio.addEventListener('error', () => URL.revokeObjectURL(url), { once: true })
  return audio.play().catch((error) => {
    URL.revokeObjectURL(url)
    throw error
  })
}

export function createVoiceController(root, {
  recorderFactory = () => createMicrophoneRecorder(),
  prisma = createPrismaAdapter(),
  timbre = createTimbreAdapter(),
  fetchImpl = globalThis.fetch,
  groq = createGroqAdapter({ fetchImpl }),
  game,
  play = playAudio,
  onMessage = () => {},
  onIntent = () => ({ ok: false, error: 'Voice intent interpretation is unavailable.' }),
} = {}) {
  const recordButton = root.querySelector('[data-voice-record]')
  const stopButton = root.querySelector('[data-voice-stop]')
  const cancelButton = root.querySelector('[data-voice-cancel]')
  const transcriptNode = root.querySelector('[data-voice-transcript]')
  let recording
  let controller
  let active = false

  function setBusy(busy) {
    active = busy
    recordButton.disabled = busy
    stopButton.hidden = !busy || !recording
    cancelButton.hidden = !busy
  }

  async function handleClip(blob) {
    if (!blob || !active) return
    stopButton.hidden = true
    showStatus(root, 'Transcribing', 'Prisma is recognizing your speech…')
    controller = new AbortController()
    let dispatcherAttempted = false
    let dispatchResult
    try {
      const result = await prisma.transcribe(blob, { signal: controller.signal })
      if (!active) return
      const recognizedSpeech = typeof result.transcript === 'string' ? result.transcript : ''
      const transcript = recognizedSpeech.trim()
      if (!transcript) throw new Error('No speech was recognized. Please try again.')
      if (game !== 'phaser-2d' && transcriptNode) transcriptNode.textContent = recognizedSpeech
      setDiagnostic(root, 'dispatcher-result', 'PROCESSING')
      setDiagnostic(root, 'last-action-status', 'PROCESSING')
      setDiagnostic(root, 'rejection-reason', 'None')
      showStatus(root, 'Interpreting', 'Groq is mapping your transcript to a supported game action.')
      const proposal = await groq.interpret(transcript, game, { signal: controller.signal })
      if (!active) return
      setDiagnostic(root, 'recognized-intent', diagnosticIntentName(proposal?.intent?.action))
      setDiagnostic(root, 'dispatcher-result', 'PROCESSING')
      setDiagnostic(root, 'last-action-status', 'PROCESSING')
      dispatcherAttempted = true
      dispatchResult = await onIntent(proposal?.intent)
      setDiagnostic(root, 'validated-intent', dispatchResult?.intent?.action
        ? diagnosticIntentJson(dispatchResult.intent)
        : 'Not validated')
      setDiagnostic(root, 'dispatcher-result', dispatchResult?.ok ? 'ACCEPTED' : 'REJECTED')
      setDiagnostic(root, 'rejection-reason', dispatchResult?.ok
        ? 'None'
        : dispatchResult?.error || 'The dispatcher rejected the intent.')
      setDiagnostic(root, 'last-action-status', dispatchResult?.ok
        ? dispatchResult.actionResult || 'Executed successfully.'
        : dispatchResult?.actionResult || `Not executed: ${dispatchResult?.error || 'The dispatcher rejected the intent.'}`)
      if (dispatchResult?.ok) {
        onMessage(`Game action accepted: ${dispatchResult.intent?.action ?? proposal.intent.action}`)
      } else {
        onMessage(dispatchResult?.error || 'The game rejected that action in the current state.')
      }
      const acknowledgment = dispatchResult?.ok
        ? `I heard you say: ${transcript}. The game accepted the ${proposal.intent.action.replaceAll('_', ' ')} command.`
        : `I heard you say: ${transcript}. The game rejected that action: ${dispatchResult?.error || 'the action is unavailable right now.'}`
      showStatus(root, 'Speaking', 'Timbre is voicing the game response. Evon is not integrated.')
      const speech = await timbre.synthesize(acknowledgment, {
        language: result.detectedLanguageCode || 'auto',
        signal: controller.signal,
      })
      if (!active) return
      await play(speech, { signal: controller.signal })
      if (!active) return
      showStatus(root, 'Ready', 'Groq interpreted the command and the game dispatcher checked it. Evon is not integrated.')
    } catch (error) {
      if (error.name === 'AbortError') return
      if (!dispatcherAttempted) {
        setDiagnostic(root, 'dispatcher-result', 'NOT ATTEMPTED')
        setDiagnostic(root, 'rejection-reason', 'Not attempted; voice processing failed before dispatch.')
        setDiagnostic(root, 'last-action-status', 'NOT ATTEMPTED')
      } else if (dispatchResult) {
        setDiagnostic(root, 'last-action-status', dispatchResult.ok
          ? `${dispatchResult.actionResult || 'Executed successfully.'} Voice response failed.`
          : `Not executed: ${dispatchResult.error || 'action rejected'}. Voice response failed.`)
      } else {
        setDiagnostic(root, 'validated-intent', 'Not returned')
        setDiagnostic(root, 'dispatcher-result', 'REJECTED')
        setDiagnostic(root, 'rejection-reason', 'Dispatcher did not return a result.')
        setDiagnostic(root, 'last-action-status', 'Not executed: dispatcher did not return a result.')
      }
      showStatus(root, 'Voice unavailable', error.message || 'Voice processing failed. You can continue playing with keyboard controls.')
    } finally {
      if (active) {
        active = false
        recordButton.disabled = false
        cancelButton.hidden = true
      }
      controller = undefined
      recording = undefined
    }
  }

  async function begin() {
    if (active) return
    resetDiagnostics(root)
    setBusy(true)
    if (game !== 'phaser-2d' && transcriptNode) transcriptNode.textContent = ''
    showStatus(root, 'Requesting microphone', 'Allow microphone access to speak to the Game Master.')
    try {
      recording = await recorderFactory().start((clip) => { void handleClip(clip) })
      if (!active) {
        await recording.cancel()
        return
      }
      showStatus(root, 'Listening', 'Listening… recording stops automatically after 30 seconds.')
      stopButton.hidden = false
    } catch (error) {
      active = false
      recordButton.disabled = false
      cancelButton.hidden = true
      setDiagnostic(root, 'rejection-reason', 'Not attempted; microphone could not start.')
      setDiagnostic(root, 'last-action-status', 'Not attempted')
      showStatus(root, 'Voice unavailable', error.name === 'NotAllowedError'
        ? 'Microphone permission was denied. Allow access in browser settings and try again.'
        : error.message || 'Unable to start microphone recording.')
    }
  }

  async function finish() {
    if (!active || !recording) return
    stopButton.hidden = true
    showStatus(root, 'Transcribing', 'Preparing your recording…')
    try {
      const clip = await recording.stop()
      recording = undefined
      await handleClip(clip)
    } catch (error) {
      active = false
      recordButton.disabled = false
      stopButton.hidden = true
      cancelButton.hidden = true
      setDiagnostic(root, 'dispatcher-result', 'Not attempted')
      setDiagnostic(root, 'rejection-reason', 'Not attempted; recording could not be submitted.')
      setDiagnostic(root, 'last-action-status', 'Not attempted')
      showStatus(root, 'Voice unavailable', error.message || 'Unable to finish recording.')
    }
  }

  async function cancel() {
    if (!active) return
    active = false
    controller?.abort()
    await recording?.cancel()
    recording = undefined
    controller = undefined
      setDiagnostic(root, 'dispatcher-result', 'NOT ATTEMPTED')
    setDiagnostic(root, 'rejection-reason', 'Not attempted; request cancelled.')
    setDiagnostic(root, 'last-action-status', 'NOT ATTEMPTED')
    recordButton.disabled = false
    stopButton.hidden = true
    cancelButton.hidden = true
    showStatus(root, 'Ready', 'Voice request cancelled. Your mission continues.')
  }

  recordButton.addEventListener('click', begin)
  stopButton.addEventListener('click', finish)
  cancelButton.addEventListener('click', cancel)
  stopButton.hidden = true
  cancelButton.hidden = true
  showStatus(root, 'Checking service', 'Checking local voice service…')
  showProviderConfiguration(root, { prisma: undefined, groq: undefined, timbre: undefined })
  resetDiagnostics(root)
  fetchImpl('/api/health').then((response) => response.json()).then((health) => {
    if (active) return
    showProviderConfiguration(root, {
      prisma: Boolean(health.configured),
      groq: Boolean(health.groq?.configured),
      timbre: Boolean(health.configured),
    })
    if (!health.configured) showStatus(root, 'Setup needed', 'Configure GNANI_API_KEY in backend/.env to enable Prisma and Timbre.')
    else if (!health.groq?.configured) {
      showStatus(root, 'Setup needed', 'Configure GROQ_API_KEY in backend/.env to interpret voice commands. Evon is not integrated.')
    } else showStatus(root, 'Ready', 'Prisma, Groq, and Timbre are ready. Evon is not integrated.')
  }).catch(() => {
    showProviderConfiguration(root, { prisma: null, groq: null, timbre: null })
    if (!active) showStatus(root, 'Backend offline', 'Start the voice backend to enable microphone interaction.')
  })

  return {
    dispatchIntent(intent) {
      return onIntent(intent)
    },
    finish,
    cancel,
    destroy() {
      void cancel()
      recordButton.removeEventListener('click', begin)
      stopButton.removeEventListener('click', finish)
      cancelButton.removeEventListener('click', cancel)
    },
  }
}
