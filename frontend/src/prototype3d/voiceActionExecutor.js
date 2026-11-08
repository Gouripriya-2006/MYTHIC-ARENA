export function executeBabylonVoiceIntent(intent, { arena, handleHudAction }) {
  const controller = arena?.controller
  if (!controller) return false

  if (intent.action === 'interact_nearest') return controller.setVirtualKey('e', true) !== false
  if (intent.action === 'light_attack') return typeof arena.executeVoiceAttack === 'function'
    ? arena.executeVoiceAttack('light')
    : controller.startAttack('light') !== false
  if (intent.action === 'heavy_attack') return typeof arena.executeVoiceAttack === 'function'
    ? arena.executeVoiceAttack('heavy')
    : controller.startAttack('heavy') !== false
  if (intent.action === 'class_ability') return controller.triggerAbility() !== false
  if (intent.action === 'use_consumable') {
    const result = handleHudAction('use-item', intent.parameters.itemId)
    return result && typeof result === 'object' && 'ok' in result ? result : result !== false
  }
  else return false
}
