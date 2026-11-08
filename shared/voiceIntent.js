export const VOICE_INTENT_VERSION = 1
export const VOICE_INTENT_GAMES = Object.freeze(['phaser-2d', 'babylon-3d'])

const ACTIONS_BY_GAME = Object.freeze({
  'phaser-2d': Object.freeze(['interact_nearest', 'light_attack']),
  'babylon-3d': Object.freeze([
    'interact_nearest', 'light_attack', 'heavy_attack', 'class_ability', 'use_consumable',
  ]),
})

export function getVoiceActions(game) {
  return ACTIONS_BY_GAME[game] ?? []
}

export function validateVoiceIntent(value, expectedGame) {
  const fail = (error) => ({ ok: false, error })
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fail('Intent must be an object.')
  if (value.version !== VOICE_INTENT_VERSION) return fail('Unsupported voice intent version.')
  if (!VOICE_INTENT_GAMES.includes(value.game)) return fail('Unsupported game.')
  if (expectedGame && value.game !== expectedGame) return fail('Intent game does not match the active game.')
  if (!getVoiceActions(value.game).includes(value.action)) return fail('Action is not allowed for this game.')
  const keys = Object.keys(value).sort().join(',')
  if (keys !== 'action,game,parameters,version') return fail('Intent contains missing or unsupported fields.')

  if (!value.parameters || typeof value.parameters !== 'object' || Array.isArray(value.parameters)) {
    return fail('Intent parameters must be an object.')
  }
  if (value.action === 'use_consumable') {
    if (Object.keys(value.parameters).sort().join(',') !== 'itemId'
      || typeof value.parameters.itemId !== 'string'
      || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(value.parameters.itemId)) {
      return fail('use_consumable requires a valid itemId.')
    }
  } else if (Object.keys(value.parameters).length !== 0) {
    return fail('This action does not accept parameters.')
  }

  return { ok: true, intent: Object.freeze({
    version: value.version,
    game: value.game,
    action: value.action,
    parameters: Object.freeze({ ...value.parameters }),
  }) }
}
