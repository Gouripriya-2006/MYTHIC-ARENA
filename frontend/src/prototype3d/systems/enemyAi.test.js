import assert from 'node:assert/strict'
import test from 'node:test'
import { createSentinelAI, updateEnemyAI } from './enemyAi.js'

test('sentinel patrols, chases within aggro range and attacks at close range', () => {
  let sentinel = createSentinelAI()
  sentinel = updateEnemyAI(sentinel, { x: 40, z: 0 }, 1)
  const patrol = sentinel
  assert.equal(patrol.mode, 'patrol')
  assert.notEqual(patrol.position.x, 0)

  sentinel = updateEnemyAI(sentinel, { x: 0, z: 32 }, 0.5)
  const chase = sentinel
  assert.equal(chase.mode, 'chase')
  assert.ok(chase.position.z > 24)

  let attack = { ...sentinel, attackCooldown: 0 }
  attack = updateEnemyAI(attack, attack.position, 0.1)
  assert.equal(attack.mode, 'telegraph')
  assert.equal(attack.attackDamage, 0)
  attack = updateEnemyAI(attack, attack.position, 0.58)
  assert.equal(attack.attackPhase, 'active')
  assert.equal(attack.attackDamage, sentinel.damage)
  attack = updateEnemyAI(attack, attack.position, 0.21)
  assert.equal(attack.attackPhase, 'recovery')
  assert.equal(attack.attackDamage, 0)
})

test('sentinel searches the last seen location before returning to its patrol anchor', () => {
  let sentinel = createSentinelAI()
  sentinel = updateEnemyAI(sentinel, { x: 0, z: 10 }, 0.1, { canSeePlayer: true })
  assert.equal(sentinel.mode, 'chase')
  assert.ok(sentinel.awarenessTime > 3)

  sentinel = updateEnemyAI(sentinel, { x: 0, z: 0 }, 1, { canSeePlayer: false })
  assert.equal(sentinel.mode, 'search')
  assert.ok(sentinel.position.z < 24)

  sentinel = { ...sentinel, awarenessTime: 0.01, position: { x: 0, y: 0, z: 10 } }
  sentinel = updateEnemyAI(sentinel, { x: 0, z: -20 }, 0.1, { canSeePlayer: false })
  sentinel = updateEnemyAI(sentinel, { x: 0, z: -20 }, 0.1, { canSeePlayer: false })
  assert.equal(sentinel.mode, 'return')
  assert.ok(sentinel.position.z > 10)
})

test('defeated sentinel no longer updates or attacks', () => {
  const sentinel = { ...createSentinelAI(), defeated: true }
  const result = updateEnemyAI(sentinel, { x: 0, z: 0 }, 1)
  assert.equal(result.mode, 'defeated')
  assert.equal(result.attackDamage, 0)
})
