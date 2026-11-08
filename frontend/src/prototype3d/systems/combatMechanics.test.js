import assert from 'node:assert/strict'
import test from 'node:test'
import {
  advanceAttackPhase,
  advanceProjectile,
  hasLineOfSight,
  isWithinAttackArc,
  resolveIncomingAttack,
  resolveProjectileSegment,
} from './combatMechanics.js'

test('enemy attack phase advances through telegraph, one active hit, and recovery', () => {
  const timing = { telegraph: 0.5, active: 0.2, recovery: 0.6 }
  let state = advanceAttackPhase({ attackCooldown: 0 }, 0.016, true, 12, 1.5, timing)
  assert.equal(state.attackPhase, 'telegraph')
  assert.equal(state.attackDamage, 0)

  state = advanceAttackPhase(state, 0.5, true, 12, 1.5, timing)
  assert.equal(state.attackPhase, 'active')
  assert.equal(state.attackDamage, 12)
  state = advanceAttackPhase(state, 0.08, true, 12, 1.5, timing)
  assert.equal(state.attackPhase, 'active')
  assert.equal(state.attackDamage, 0)

  state = advanceAttackPhase(state, 0.13, true, 12, 1.5, timing)
  assert.equal(state.attackPhase, 'recovery')
  state = advanceAttackPhase(state, 0.61, false, 12, 1.5, timing)
  assert.equal(state.attackPhase, 'idle')
})

test('melee arc accepts close targets in front and rejects targets behind or out of range', () => {
  const player = { x: 0, z: 0 }
  const forward = { x: 0, z: 1 }
  assert.equal(isWithinAttackArc(player, forward, { x: 0.2, z: 2 }, 3), true)
  assert.equal(isWithinAttackArc(player, forward, { x: 0, z: -1 }, 3), false)
  assert.equal(isWithinAttackArc(player, forward, { x: 0, z: 4 }, 3), false)
})

test('a telegraphed strike is dodged or guarded only when the player faces its source', () => {
  assert.deepEqual(resolveIncomingAttack(15, { invulnerable: true }), { hit: false, damage: 0, result: 'dodged' })
  assert.equal(resolveIncomingAttack(15, { blocking: true, facingAttacker: true }).damage, 5)
  assert.equal(resolveIncomingAttack(15, { blocking: true, facingAttacker: false }).damage, 15)
  assert.equal(resolveIncomingAttack(25, { blocking: true, blockDamageMultiplier: 0.2 }).damage, 5)
  assert.equal(resolveIncomingAttack(15, {}).result, 'hit')
})

test('line of sight is blocked by a circle collider intersecting the view segment', () => {
  const wall = { x: 0, z: 5, radius: 1 }
  assert.equal(hasLineOfSight({ x: 0, z: 0 }, { x: 0, z: 10 }, [wall]), false)
  assert.equal(hasLineOfSight({ x: 0, z: 0 }, { x: 5, z: 10 }, [wall]), true)
  assert.equal(hasLineOfSight({ x: 0, z: 0 }, { x: 0, z: 10 }, []), true)
})

test('projectile segment hits the first target unless an obstacle is in front', () => {
  const start = { x: 0, y: 1, z: 0 }
  const end = { x: 0, y: 1, z: 10 }
  const target = { id: 'sentinel', position: { x: 0, z: 8 }, radius: 0.8 }
  assert.equal(resolveProjectileSegment(start, end, [], [target]).targetId, 'sentinel')

  const result = resolveProjectileSegment(start, end, [{ x: 0, z: 4, radius: 0.6 }], [target])
  assert.equal(result.type, 'blocked')
  assert.equal(result.targetId, null)
})

test('projectile advances over time and expires at its range instead of applying hitscan damage', () => {
  const projectile = {
    position: { x: 0, y: 1, z: 0 },
    direction: { x: 0, z: 1 },
    speed: 12,
    traveled: 0,
    maxDistance: 20,
  }
  const firstFrame = advanceProjectile(projectile, 0.1)
  assert.ok(Math.abs(firstFrame.projectile.position.z - 1.2) < 1e-9)
  assert.equal(firstFrame.finished, false)

  const lastFrame = advanceProjectile({ ...projectile, traveled: 19.5, position: { x: 0, y: 1, z: 19.5 } }, 0.1)
  assert.equal(lastFrame.projectile.traveled, 20)
  assert.equal(lastFrame.finished, true)
})
