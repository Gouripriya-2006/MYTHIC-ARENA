import { validateVoiceIntent } from '../../../../shared/voiceIntent.js'

export const PHASER_VOICE_ATTACK_RANGE = 160

export function isWithinPhaserAttackRange(distance, range, { inclusive = false } = {}) {
  return inclusive ? distance <= range : distance < range
}

export function canExecutePhaserVoiceAttack({ state, player, sentinel, now, lastAttack }) {
  return state?.status === 'active'
    && state.objectives?.relic === true
    && state.sentinelHealth > 0
    && player
    && sentinel
    && now - lastAttack >= 420
}

export function createPhaserVoiceActionDispatcher(scene) {
  return {
    dispatch(value) {
      const parsed = validateVoiceIntent(value, 'phaser-2d')
      if (!parsed.ok) return parsed
      if (typeof scene?.canExecuteVoiceAction !== 'function'
        || !scene.canExecuteVoiceAction(parsed.intent.action)) {
        return {
          ok: false,
          error: scene.getVoiceActionRejectionReason?.(parsed.intent.action)
            || 'That action is not available in the current game state.',
          intent: parsed.intent,
        }
      }
      const executed = scene.executeVoiceAction(parsed.intent.action)
      if (executed !== true) {
        return {
          ok: false,
          error: 'The game rejected that action because its conditions changed.',
          intent: parsed.intent,
        }
      }
      return { ok: true, intent: parsed.intent }
    },
  }
}
