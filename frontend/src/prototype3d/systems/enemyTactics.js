import { hasLineOfSight } from './combatMechanics.js'

export function canEnemyDetectPlayer(enemy, playerPosition, obstacles = []) {
  const dx = playerPosition.x - enemy.position.x
  const dz = playerPosition.z - enemy.position.z
  const distance = Math.hypot(dx, dz)
  const visionRange = enemy.visionRange ?? enemy.aggroRange
  if (distance > visionRange || !hasLineOfSight(enemy.position, playerPosition, obstacles)) return false
  if (distance < 0.001) return true

  const yaw = enemy.facingYaw ?? 0
  const facing = { x: Math.sin(yaw), z: Math.cos(yaw) }
  const dot = (dx * facing.x + dz * facing.z) / distance
  return dot >= Math.cos((enemy.visionAngle ?? Math.PI * 0.72) / 2)
}

export function coordinateEnemyAttacks(enemies, playerPosition, { maxConcurrent = 2, canSee = () => true } = {}) {
  const engaged = enemies
    .filter((enemy) => !enemy.defeated && enemy.attackStyle !== 'boss')
    .map((enemy) => {
      const distance = Math.hypot(playerPosition.x - enemy.position.x, playerPosition.z - enemy.position.z)
      const inRange = distance <= enemy.attackRange && distance >= (enemy.minAttackRange ?? 0)
      return { enemy, distance, eligible: canSee(enemy) && inRange }
    })
  const incumbents = engaged.filter(({ enemy }) => ['telegraph', 'active'].includes(enemy.attackPhase))
  const waiting = engaged.filter(({ enemy, eligible }) => eligible && !['telegraph', 'active'].includes(enemy.attackPhase))
    .sort((a, b) => (b.enemy.attackWaitTime ?? 0) - (a.enemy.attackWaitTime ?? 0)
      || a.distance - b.distance
      || a.enemy.id.localeCompare(b.enemy.id))
  return new Set([...incumbents, ...waiting.slice(0, Math.max(0, maxConcurrent - incumbents.length))].map(({ enemy }) => enemy.id))
}

export function applyEnemySeparation(enemy, position, neighbors = [], deltaSeconds = 0, strength = 1) {
  let pushX = 0
  let pushZ = 0
  let count = 0
  for (const neighbor of neighbors) {
    if (neighbor.id === enemy.id || neighbor.defeated) continue
    const dx = position.x - neighbor.position.x
    const dz = position.z - neighbor.position.z
    const distance = Math.hypot(dx, dz)
    const desired = (enemy.collisionRadius ?? 0.7) + (neighbor.collisionRadius ?? 0.7) + 0.22
    if (distance >= desired) continue
    if (distance < 0.001) {
      const angle = (enemy.id.length * 1.71 + neighbor.id.length * 0.83) % (Math.PI * 2)
      pushX += Math.cos(angle)
      pushZ += Math.sin(angle)
    } else {
      const amount = (desired - distance) / desired
      pushX += (dx / distance) * amount
      pushZ += (dz / distance) * amount
    }
    count += 1
  }
  if (count === 0) return position
  const magnitude = Math.hypot(pushX, pushZ)
  if (magnitude < 0.001) return position
  const maxPush = Math.max(0, deltaSeconds) * (enemy.speed ?? 1) * 0.7 * strength
  const push = Math.min(maxPush, magnitude * 0.18)
  return { ...position, x: position.x + pushX / magnitude * push, z: position.z + pushZ / magnitude * push }
}

export function getEncounterAttackLimit(progress) {
  if (!progress?.objectives?.relic) return 0
  if (!progress.objectives.sentinel || !progress.objectives.boss) return 1
  return 2
}
