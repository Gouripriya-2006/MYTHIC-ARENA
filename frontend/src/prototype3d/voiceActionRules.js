import { canStartPlayerAttack, getPlayerAttackRange } from './playerCombat.js'

export function canExecuteArenaVoiceAction(intent, state, {
  paused = false,
  classId,
  findNearestInteraction,
  findNearestActiveEnemy,
  findAttackTarget,
  abilityCooldownRemaining = 0,
  abilityCost = 0,
  abilityRange = 0,
  canUseItem,
  canStartAttack,
  abilityRangeBonus = 0,
}) {
  if (state?.status !== 'active' || paused) return false

  if (intent.action === 'interact_nearest') return Boolean(findNearestInteraction())
  const attackIsReady = (type) => canStartAttack
    ? canStartAttack(type)
    : canStartPlayerAttack({ type, status: state.status, paused, stamina: state.stamina, cooldownRemaining: 0 })
  if (intent.action === 'light_attack') return attackIsReady('light') && Boolean(findNearestActiveEnemy())
  if (intent.action === 'heavy_attack') return attackIsReady('heavy')
    && Boolean(findAttackTarget(getPlayerAttackRange('heavy', classId, abilityRangeBonus)))
  if (intent.action === 'class_ability') {
    return abilityCooldownRemaining <= 0
      && state.stamina >= abilityCost
      && (classId === 'guardian' || Boolean(findAttackTarget(abilityRange)))
  }
  if (intent.action === 'use_consumable') return Boolean(canUseItem(state, intent.parameters.itemId))
  return false
}
