export const DEFAULT_ATTACK_TIMING = Object.freeze({
  telegraph: 0.58,
  active: 0.2,
  recovery: 0.78,
})

export function advanceAttackPhase(state, deltaSeconds, canStart, damage, interval, timing = DEFAULT_ATTACK_TIMING) {
  let phase = state.attackPhase ?? 'idle'
  let phaseTime = state.attackPhaseTime ?? 0
  let attackCooldown = Math.max(0, (state.attackCooldown ?? 0) - deltaSeconds)
  let attackDamage = 0

  if (phase === 'idle') {
    if (canStart && attackCooldown === 0) {
      phase = 'telegraph'
      phaseTime = 0
      attackCooldown = interval
    }
  } else {
    phaseTime += deltaSeconds
    const duration = timing[phase]
    if (duration !== undefined && phaseTime >= duration) {
      phaseTime = 0
      if (phase === 'telegraph') {
        phase = 'active'
        attackDamage = damage
      } else if (phase === 'active') {
        phase = 'recovery'
      } else {
        phase = 'idle'
      }
    }
  }

  return { attackPhase: phase, attackPhaseTime: phaseTime, attackCooldown, attackDamage }
}

export function isWithinAttackArc(attacker, facing, target, range, halfAngleRadians = Math.PI * 0.39) {
  const dx = target.x - attacker.x
  const dz = target.z - attacker.z
  const distance = Math.hypot(dx, dz)
  if (distance === 0) return true
  if (distance > range) return false
  const facingLength = Math.hypot(facing.x, facing.z)
  if (facingLength === 0) return false
  const dot = (dx * facing.x + dz * facing.z) / (distance * facingLength)
  return dot >= Math.cos(halfAngleRadians)
}

export function resolveIncomingAttack(baseDamage, {
  invulnerable = false,
  blocking = false,
  facingAttacker = true,
  blockDamageMultiplier = 0.32,
} = {}) {
  if (invulnerable) return { hit: false, damage: 0, result: 'dodged' }
  const guarded = blocking && facingAttacker
  return {
    hit: true,
    damage: guarded ? Math.max(1, Math.ceil(baseDamage * Math.min(1, Math.max(0, blockDamageMultiplier)))) : baseDamage,
    result: guarded ? 'blocked' : 'hit',
  }
}

export function segmentCircleEntry(start, end, center, radius) {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const fx = start.x - center.x
  const fz = start.z - center.z
  const a = dx * dx + dz * dz
  if (a === 0) return fx * fx + fz * fz <= radius * radius ? 0 : null
  const c = fx * fx + fz * fz - radius * radius
  if (c <= 0) return 0
  const b = 2 * (fx * dx + fz * dz)
  const discriminant = b * b - 4 * a * c
  if (discriminant < 0) return null
  const t = (-b - Math.sqrt(discriminant)) / (2 * a)
  return t >= 0 && t <= 1 ? t : null
}

export function hasLineOfSight(start, end, obstacles = []) {
  return obstacles.every((obstacle) => segmentCircleEntry(start, end, obstacle, obstacle.radius) === null)
}

export function resolveProjectileSegment(start, end, obstacles = [], targets = []) {
  const hits = [
    ...obstacles.map((obstacle) => ({ type: 'blocked', value: obstacle, t: segmentCircleEntry(start, end, obstacle, obstacle.radius) })),
    ...targets.map((target) => ({ type: 'target', value: target, t: segmentCircleEntry(start, end, target.position, target.radius) })),
  ].filter((hit) => hit.t !== null).sort((a, b) => a.t - b.t)

  const first = hits[0]
  if (!first) return null
  return {
    type: first.type,
    targetId: first.type === 'target' ? first.value.id : null,
    t: first.t,
    position: {
      x: start.x + (end.x - start.x) * first.t,
      y: start.y + (end.y - start.y) * first.t,
      z: start.z + (end.z - start.z) * first.t,
    },
  }
}

export function advanceProjectile(projectile, deltaSeconds, obstacles = [], targets = []) {
  const step = Math.min(projectile.speed * deltaSeconds, projectile.maxDistance - projectile.traveled)
  const start = projectile.position
  const end = {
    x: start.x + projectile.direction.x * step,
    y: start.y,
    z: start.z + projectile.direction.z * step,
  }
  const collision = resolveProjectileSegment(start, end, obstacles, targets)
  const nextPosition = collision?.position ?? end
  const nextProjectile = {
    ...projectile,
    position: nextPosition,
    traveled: projectile.traveled + step,
  }
  return {
    projectile: nextProjectile,
    collision,
    finished: Boolean(collision) || nextProjectile.traveled >= projectile.maxDistance,
  }
}
