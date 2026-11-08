import { advanceAttackPhase } from './combatMechanics.js'

export const BOSS_ATTACKS = Object.freeze({
  'shadow-slash': Object.freeze({
    name: 'Shadow Slash',
    damage: 18,
    range: 4.2,
    radius: 4.2,
    kind: 'melee',
    cooldown: 2.8,
    timing: { telegraph: 0.9, active: 0.18, recovery: 1.15 },
    warning: 'A sweeping blade strike. Dodge through the red arc or guard.',
  }),
  'veil-wave': Object.freeze({
    name: 'Veil Wave',
    damage: 23,
    range: 11,
    radius: 5.4,
    kind: 'radial',
    cooldown: 3.2,
    timing: { telegraph: 1.05, active: 0.2, recovery: 1.2 },
    warning: 'A ground wave is forming around Ravana. Get beyond the red ring.',
  }),
  'flame-burst': Object.freeze({
    name: 'Flame Burst',
    damage: 23,
    range: 20,
    radius: 3.2,
    kind: 'targeted',
    cooldown: 3.8,
    timing: { telegraph: 1.15, active: 0.2, recovery: 1.3 },
    warning: 'Veil fire marks the ground. Leave the red circle before it erupts.',
  }),
  'shadow-dash': Object.freeze({
    name: 'Shadow Dash',
    damage: 25,
    range: 22,
    radius: 2.8,
    kind: 'dash',
    cooldown: 3.7,
    timing: { telegraph: 0.95, active: 0.18, recovery: 1.35 },
    warning: 'Ravana is lining up a dash. Evade the marked landing point.',
  }),
  'final-fury': Object.freeze({
    name: 'Final Fury',
    damage: 32,
    range: 9,
    radius: 6.5,
    kind: 'radial',
    cooldown: 4.4,
    timing: { telegraph: 1.3, active: 0.22, recovery: 1.55 },
    warning: 'Final Fury! Break away from the expanding red ring.',
  }),
})

const PHASE_ATTACKS = {
  1: ['shadow-slash'],
  2: ['veil-wave', 'flame-burst'],
  3: ['shadow-dash', 'final-fury'],
}

function getBossPhase(healthRatio) {
  return healthRatio <= 0.4 ? 3 : healthRatio <= 0.7 ? 2 : 1
}

function getDashDestination(origin, target) {
  const dx = target.x - origin.x
  const dz = target.z - origin.z
  const distance = Math.hypot(dx, dz)
  if (distance < 0.1) return { x: origin.x, z: origin.z - 1.7 }
  return {
    x: target.x - (dx / distance) * 1.7,
    z: target.z - (dz / distance) * 1.7,
  }
}

export function createLostKingdomBoss(position = { x: 0, y: 0, z: 40 }) {
  return {
    id: 'boss',
    name: 'Ravana, Warden of the Veil',
    position: { ...position },
    anchor: { ...position },
    mode: 'dormant',
    phase: 1,
    speed: 2.5,
    returnSpeed: 2.6,
    attackRange: 4.2,
    aggroRange: 25,
    awarenessDuration: 4.2,
    awarenessTime: 0,
    lastKnownPosition: { ...position },
    damage: 18,
    attackCooldown: 1.2,
    attackInterval: 2.8,
    attackPhase: 'idle',
    attackPhaseTime: 0,
    attackPattern: null,
    attackTarget: null,
    dashDestination: null,
    attackIndex: 0,
    defeated: false,
  }
}

export function updateBossAI(boss, playerPosition, healthRatio, deltaSeconds, { canSeePlayer = true } = {}) {
  if (boss.defeated) {
    return {
      ...boss,
      mode: 'defeated',
      attackDamage: 0,
      attackPattern: null,
      attackPhase: 'idle',
      phaseChanged: false,
      attackStarted: false,
    }
  }

  const phase = getBossPhase(healthRatio)
  const phaseChanged = phase !== (boss.phase ?? 1)
  const current = phaseChanged
    ? {
      ...boss,
      phase,
      attackPhase: 'idle',
      attackPhaseTime: 0,
      attackPattern: null,
      attackTarget: null,
      dashDestination: null,
      attackIndex: 0,
      attackCooldown: Math.max(boss.attackCooldown ?? 0, 1.35),
    }
    : boss
  const dx = playerPosition.x - current.position.x
  const dz = playerPosition.z - current.position.z
  const distance = Math.hypot(dx, dz)
  const sequence = PHASE_ATTACKS[phase]
  const nextPattern = sequence[(current.attackIndex ?? 0) % sequence.length]
  const patternId = current.attackPhase === 'idle' ? nextPattern : current.attackPattern ?? nextPattern
  const pattern = BOSS_ATTACKS[patternId]
  const canSee = canSeePlayer && distance <= current.aggroRange
  const canStart = canSee && distance <= pattern.range
  const startingAttack = current.attackPhase === 'idle'
    && canStart
    && (current.attackCooldown ?? 0) <= deltaSeconds
  const attackTarget = startingAttack
    ? { x: playerPosition.x, z: playerPosition.z }
    : current.attackTarget
  const dashDestination = startingAttack && pattern.kind === 'dash'
    ? getDashDestination(current.position, attackTarget)
    : current.dashDestination

  let awarenessTime = current.awarenessTime ?? 0
  let lastKnownPosition = current.lastKnownPosition ?? { ...current.position }
  let x = current.position.x
  let z = current.position.z
  let mode = 'guard'

  if (canSee) {
    awarenessTime = current.awarenessDuration
    lastKnownPosition = { x: playerPosition.x, z: playerPosition.z }
    if (distance > pattern.range) {
      mode = 'stalk'
      const speed = current.speed * (phase === 3 ? 1.65 : phase === 2 ? 1.2 : 1)
      const step = Math.min(speed * deltaSeconds, distance - Math.min(pattern.range, 5))
      if (distance > 0) {
        x += (dx / distance) * step
        z += (dz / distance) * step
      }
    } else if (phase === 2 && current.attackPhase === 'idle' && distance > 0.1) {
      mode = 'flank'
      const direction = current.attackIndex % 2 === 0 ? 1 : -1
      const step = Math.min(1.05 * deltaSeconds, distance * 0.12)
      x += (-dz / distance) * step * direction
      z += (dx / distance) * step * direction
    } else {
      mode = 'attack'
    }
  } else if (awarenessTime > 0) {
    awarenessTime = Math.max(0, awarenessTime - deltaSeconds)
    const searchX = lastKnownPosition.x - x
    const searchZ = lastKnownPosition.z - z
    const searchDistance = Math.hypot(searchX, searchZ)
    mode = 'search'
    if (searchDistance > 1.2) {
      const step = Math.min(current.speed * 0.72 * deltaSeconds, searchDistance)
      x += (searchX / searchDistance) * step
      z += (searchZ / searchDistance) * step
    }
  } else {
    awarenessTime = 0
    const homeX = current.anchor.x - x
    const homeZ = current.anchor.z - z
    const homeDistance = Math.hypot(homeX, homeZ)
    const wasAlerted = ['stalk', 'search', 'attack', 'telegraph', 'recovery', 'return', 'flank'].includes(current.mode)
    if (wasAlerted && homeDistance > 0.4) {
      mode = 'return'
      const step = Math.min(current.returnSpeed * deltaSeconds, homeDistance)
      x += (homeX / homeDistance) * step
      z += (homeZ / homeDistance) * step
    }
  }

  const attackState = {
    ...current,
    attackPattern: startingAttack ? nextPattern : current.attackPattern,
    attackTarget,
    dashDestination,
  }
  const attack = advanceAttackPhase(
    attackState,
    deltaSeconds,
    canStart,
    pattern.damage,
    pattern.cooldown,
    pattern.timing,
  )
  const attackStarted = attackState.attackPhase === 'idle' && attack.attackPhase === 'telegraph'
  const attackPattern = attackState.attackPattern
  let dashArrived = false
  if (attackPattern === 'shadow-dash' && dashDestination && attack.attackPhase === 'telegraph') {
    const dashX = dashDestination.x - x
    const dashZ = dashDestination.z - z
    const dashDistance = Math.hypot(dashX, dashZ)
    if (dashDistance > 0.15) {
      const step = Math.min(12 * deltaSeconds, dashDistance)
      x += (dashX / dashDistance) * step
      z += (dashZ / dashDistance) * step
    } else {
      dashArrived = true
    }
  }
  if (attack.attackPhase === 'active' && attackPattern === 'shadow-dash' && dashDestination) {
    x = dashDestination.x
    z = dashDestination.z
  }

  const attackMode = attack.attackPhase === 'telegraph'
    ? 'telegraph'
    : attack.attackPhase === 'active'
      ? 'attack'
      : attack.attackPhase === 'recovery'
        ? 'recovery'
        : mode
  const phaseLimit = 17.5
  const arenaDx = x - current.anchor.x
  const arenaDz = z - current.anchor.z
  const arenaDistance = Math.hypot(arenaDx, arenaDz)
  if (arenaDistance > phaseLimit) {
    x = current.anchor.x + arenaDx / arenaDistance * phaseLimit
    z = current.anchor.z + arenaDz / arenaDistance * phaseLimit
  }

  const completedRecovery = current.attackPhase === 'recovery' && attack.attackPhase === 'idle'
  return {
    ...current,
    mode: attackMode,
    phase,
    phaseChanged,
    attackStarted,
    attackPhase: attack.attackPhase,
    attackPhaseTime: attack.attackPhaseTime,
    attackCooldown: attack.attackCooldown,
    attackDamage: attack.attackDamage,
    attackPattern,
    attackTarget: completedRecovery ? null : attackTarget,
    dashDestination: completedRecovery ? null : dashDestination,
    attackIndex: startingAttack ? (current.attackIndex + 1) : current.attackIndex,
    awarenessTime,
    lastKnownPosition,
    position: { x, y: current.position.y, z },
    facingYaw: Math.atan2(dx, dz),
    dashArrived: attackPattern === 'shadow-dash' && (dashArrived || attack.attackPhase === 'active'),
  }
}
