import { validateVoiceIntent } from '../../../shared/voiceIntent.js'

export function createBabylonVoiceActionDispatcher({ getState, canExecute, execute, getRejectionReason }) {
  return {
    dispatch(value) {
      const parsed = validateVoiceIntent(value, 'babylon-3d')
      if (!parsed.ok) return parsed
      const state = getState()
      if (state?.status !== 'active' || !canExecute(parsed.intent, state)) {
        return { ok: false, error: getRejectionReason?.(parsed.intent, state)
          ?? 'That action is not available in the current game state.', intent: parsed.intent }
      }
      const complete = (execution) => {
        if (execution === false || execution?.ok === false) {
          return {
            ok: false,
            error: execution?.error || 'The game rejected that action before execution.',
            intent: parsed.intent,
            actionResult: execution?.actionResult || 'Action did not succeed.',
          }
        }
        return {
          ok: true,
          intent: parsed.intent,
          actionResult: execution?.actionResult || 'Executed successfully.',
        }
      }
      try {
        const execution = execute(parsed.intent)
        return execution && typeof execution.then === 'function'
          ? execution.then(complete, (error) => ({
            ok: false,
            error: error?.message || 'The game action failed safely.',
            intent: parsed.intent,
            actionResult: 'Action failed during execution.',
          }))
          : complete(execution)
      } catch (error) {
        return {
          ok: false,
          error: error?.message || 'The game action failed safely.',
          intent: parsed.intent,
          actionResult: 'Action failed during execution.',
        }
      }
    },
  }
}
