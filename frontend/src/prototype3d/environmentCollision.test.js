import assert from 'node:assert/strict'
import test from 'node:test'
import { createBoxCollider, createRiverCollisionBounds, isWorldPositionWalkable } from './environmentCollision.js'

test('environment boundaries respect player radius and block points outside the world', () => {
  const blockers = [createBoxCollider(8, 8, 4, 2, 'ruin-wall')]
  assert.equal(isWorldPositionWalkable(8, 8, { boxColliders: blockers }), false)
  assert.equal(isWorldPositionWalkable(8, 9.63, { boxColliders: blockers }), true)
  assert.equal(isWorldPositionWalkable(69, 0), false)
  assert.equal(isWorldPositionWalkable(67, 0), true)
})

test('existing circular obstacle collision remains compatible', () => {
  const trees = [{ x: -8, z: 4, radius: 1.05 }]
  assert.equal(isWorldPositionWalkable(-8, 4, { circleColliders: trees }), false)
  assert.equal(isWorldPositionWalkable(-8, 6, { circleColliders: trees }), true)
})

test('river banks block entry while preserving the existing bridge crossing gap', () => {
  const riverBounds = createRiverCollisionBounds()
  assert.equal(isWorldPositionWalkable(31, 0, { boxColliders: riverBounds }), false)
  assert.equal(isWorldPositionWalkable(31, 20, { boxColliders: riverBounds }), true)
  assert.equal(isWorldPositionWalkable(31, 32, { boxColliders: riverBounds }), false)
  assert.equal(isWorldPositionWalkable(22.5, 0, { boxColliders: riverBounds }), true)
})

test('a narrow route remains usable between new environmental walls', () => {
  const wallBounds = [
    createBoxCollider(-4, 24, 0.8, 16, 'west-sanctum-wall'),
    createBoxCollider(4, 24, 0.8, 16, 'east-sanctum-wall'),
  ]
  assert.equal(isWorldPositionWalkable(0, 24, { boxColliders: wallBounds }), true)
  assert.equal(isWorldPositionWalkable(-4, 24, { boxColliders: wallBounds }), false)
})
