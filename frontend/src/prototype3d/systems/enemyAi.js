import { advanceAttackPhase } from './combatMechanics.js'
import { applyEnemySeparation } from './enemyTactics.js'

const ATTACK_TIMING = { telegraph: 0.58, active: 0.2, recovery: 0.78 }

export function updateEnemyAI(enemy, playerPosition, deltaSeconds, { canSeePlayer = true, attackAllowed = true, neighbors = [] } = {}) {
  if (enemy.defeated) return { ...enemy, mode: 'defeated', attackDamage: 0, attackPhase: 'idle' }

  const dx = playerPosition.x - enemy.position.x
  const dz = playerPosition.z - enemy.position.z
  const distance = Math.hypot(dx, dz)
  let awarenessTime = enemy.awarenessTime ?? 0
  let lastKnownPosition = enemy.lastKnownPosition ?? { ...enemy.position }
  let patrolTime = enemy.patrolTime
  let x = enemy.position.x
  let z = enemy.position.z
  let mode
  let canAttack = false

  if (canSeePlayer && distance <= enemy.aggroRange) {
    awarenessTime = enemy.awarenessDuration
    lastKnownPosition = { x: playerPosition.x, z: playerPosition.z }
    canAttack = distance <= enemy.attackRange && distance >= (enemy.minAttackRange ?? 0)
    mode = canAttack ? attackAllowed ? 'attack' : 'coordinate' : distance < (enemy.minAttackRange ?? 0) ? 'reposition' : 'chase'
    if (distance > enemy.attackRange && distance > 0) {
      const step = Math.min(enemy.speed * (enemy.chaseSpeedMultiplier ?? 1) * deltaSeconds, distance - enemy.attackRange)
      x += (dx / distance) * step
      z += (dz / distance) * step
    } else if (distance < (enemy.minAttackRange ?? 0) && distance > 0) {
      const step = Math.min(enemy.speed * deltaSeconds, (enemy.minAttackRange - distance) * 0.8)
      x -= (dx / distance) * step
      z -= (dz / distance) * step
    }
  } else if (awarenessTime > 0) {
    awarenessTime = Math.max(0, awarenessTime - deltaSeconds)
    const searchX = lastKnownPosition.x - x
    const searchZ = lastKnownPosition.z - z
    const searchDistance = Math.hypot(searchX, searchZ)
    mode = 'search'
    if (searchDistance > 1.1) {
      const step = Math.min(enemy.speed * 0.72 * deltaSeconds, searchDistance)
      x += (searchX / searchDistance) * step
      z += (searchZ / searchDistance) * step
    }
  } else {
    awarenessTime = 0
    const homeX = enemy.anchor.x - x
    const homeZ = enemy.anchor.z - z
    const homeDistance = Math.hypot(homeX, homeZ)
    const wasAlerted = ['chase', 'search', 'attack', 'telegraph', 'recovery', 'return'].includes(enemy.mode)
    if (wasAlerted && homeDistance > 0.45) {
      mode = 'return'
      const step = Math.min(enemy.returnSpeed * deltaSeconds, homeDistance)
      x += (homeX / homeDistance) * step
      z += (homeZ / homeDistance) * step
    } else if (homeDistance <= 0.45) {
      mode = 'patrol'
      patrolTime += deltaSeconds
      x = enemy.anchor.x + Math.sin(patrolTime * 0.7) * enemy.patrolRadius
      z = enemy.anchor.z
    } else {
      mode = 'patrol'
      patrolTime += deltaSeconds
      x = enemy.anchor.x + Math.sin(patrolTime * 0.7) * enemy.patrolRadius
      z = enemy.anchor.z
    }
  }

  const attackWaitTime = canAttack && !attackAllowed ? (enemy.attackWaitTime ?? 0) + deltaSeconds : 0
  const attack = advanceAttackPhase(
    enemy,
    deltaSeconds,
    canAttack && attackAllowed,
    enemy.damage,
    enemy.attackInterval,
    enemy.attackTiming ?? ATTACK_TIMING,
  )
  const attackMode = attack.attackPhase === 'telegraph'
    ? 'telegraph'
    : attack.attackPhase === 'active'
      ? 'attack'
      : attack.attackPhase === 'recovery'
        ? 'recovery'
        : mode

  const movement = applyEnemySeparation(enemy, { x, y: enemy.position.y, z }, neighbors, deltaSeconds)
  const movedX = movement.x - enemy.position.x
  const movedZ = movement.z - enemy.position.z
  const facingYaw = canSeePlayer
    ? Math.atan2(dx, dz)
    : Math.hypot(movedX, movedZ) > 0.001 ? Math.atan2(movedX, movedZ) : enemy.facingYaw ?? 0

  return {
    ...enemy,
    mode: attackMode,
    attackPhase: attack.attackPhase,
    attackPhaseTime: attack.attackPhaseTime,
    attackCooldown: attack.attackCooldown,
    attackDamage: attack.attackDamage,
    attackWaitTime,
    awarenessTime,
    lastKnownPosition,
    patrolTime,
    position: movement,
    facingYaw,
  }
}

export function createSentinelAI(position = { x: 0, y: 0, z: 24 }) {
  return createEnemyAI({
    id: 'sentinel',
    name: 'Veil Sentinel',
    patrolRadius: 4.5,
    speed: 2.2,
    returnSpeed: 2.8,
    aggroRange: 18,
    awarenessDuration: 3.2,
    attackRange: 2.35,
    damage: 11,
    attackInterval: 1.65,
    attackCooldown: 1,
    attackTiming: ATTACK_TIMING,
  }, position)
}

export function createEnemyAI(archetype, position = archetype.position ?? { x: 0, y: 0, z: 0 }) {
  const spawn = { ...position }
  return {
    ...archetype,
    position: spawn,
    anchor: { ...spawn },
    patrolTime: 0,
    mode: 'patrol',
    awarenessTime: 0,
    lastKnownPosition: { x: spawn.x, z: spawn.z },
    attackCooldown: archetype.attackCooldown ?? Math.min(0.65, archetype.attackInterval * 0.45),
    attackPhase: 'idle',
    attackPhaseTime: 0,
    facingYaw: 0,
    defeated: false,
  }
}
