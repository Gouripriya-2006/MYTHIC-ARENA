export const PLAYER_ATTACK_COST = Object.freeze({ light: 14, heavy: 30 })
export const PLAYER_ATTACK_COOLDOWN = Object.freeze({ light: 0.4, heavy: 0.62 })

export function getPlayerAttackRange(type, classId, abilityRangeBonus = 0) {
  if (type === 'light' && classId === 'mage') return 20 + abilityRangeBonus
  return type === 'heavy' ? 3.8 : 3.1
}

export function executeInstantDefeat(target, applyEnemyHit) {
  if (!target || typeof target.id !== 'string' || !Number.isFinite(target.health) || target.health <= 0) return false
  return applyEnemyHit(target.id, target.health, 'Strike')
}

export function findNearestEnemyTarget(enemies, origin) {
  return enemies
    .filter((enemy) => enemy && enemy.defeated !== true
      && Number.isFinite(enemy.health) && enemy.health > 0
      && Number.isFinite(enemy.position?.x) && Number.isFinite(enemy.position?.z))
    .sort((a, b) => Math.hypot(origin.x - a.position.x, origin.z - a.position.z)
      - Math.hypot(origin.x - b.position.x, origin.z - b.position.z))[0] ?? null
}

export function canStartPlayerAttack({ type, status, paused, stamina, cooldownRemaining }) {
  const cost = PLAYER_ATTACK_COST[type]
  return Boolean(cost)
    && status === 'active'
    && !paused
    && stamina >= cost
    && cooldownRemaining <= 0
}

export function getPlayerAttackRejectionReason({ type, status, paused, stamina, cooldownRemaining }) {
  if (status !== 'active') return 'The game is not in an active state.'
  if (paused) return 'Close the current game panel before attacking.'
  if (stamina < PLAYER_ATTACK_COST[type]) return `Not enough stamina for a ${type} attack.`
  if (cooldownRemaining > 0) return 'Your next strike is not ready yet.'
  return null
}

export function directionToTarget(origin, target) {
  const dx = target.x - origin.x
  const dz = target.z - origin.z
  const distance = Math.hypot(dx, dz)
  if (!distance) return { x: 0, z: 0 }
  return { x: dx / distance, z: dz / distance }
}

export function calculatePlayerAttackDamage({
  type,
  classId,
  weaponDamage = 0,
  meleeDamageBonus = 0,
  spellDamageBonus = 0,
  heavyDamageBonus = 0,
  critical = false,
}) {
  const baseDamage = { warrior: 24, mage: 34, guardian: 18 }[classId]
  if (!baseDamage || !['light', 'heavy'].includes(type)) return 0
  const rangedMage = classId === 'mage' && type === 'light'
  const classDamage = rangedMage ? spellDamageBonus : meleeDamageBonus
  const heavyMultiplier = type === 'heavy' ? 1 + heavyDamageBonus : 1
  const damage = Math.round(((type === 'heavy' ? baseDamage * 1.65 : baseDamage) + weaponDamage)
    * (1 + classDamage) * heavyMultiplier)
  return critical ? Math.round(damage * 1.5) : damage
}
