import assert from 'node:assert/strict'
import test from 'node:test'
import { createEnemyAI, updateEnemyAI } from './enemyAi.js'
import { getEnemyArchetype } from './enemyArchetypes.js'
import {
  applyEnemySeparation,
  canEnemyDetectPlayer,
  coordinateEnemyAttacks,
  getEncounterAttackLimit,
} from './enemyTactics.js'

test('sight detection respects enemy facing, configured vision range, and blockers', () => {
  const enemy = { ...createEnemyAI(getEnemyArchetype('goblin')), facingYaw: 0 }
  assert.equal(canEnemyDetectPlayer(enemy, { x: enemy.position.x, z: enemy.position.z + 5 }), true)
  assert.equal(canEnemyDetectPlayer(enemy, { x: enemy.position.x + 5, z: enemy.position.z }), false)
  assert.equal(canEnemyDetectPlayer(enemy, { x: 0, z: 20 }), false)
  assert.equal(canEnemyDetectPlayer(enemy, { x: enemy.position.x, z: enemy.position.z + 5 }, [{ x: enemy.position.x, z: enemy.position.z + 2.5, radius: 0.7 }]), false)
})

test('enemies search the last seen point then return home, and do not instantly reacquire behind them', () => {
  const enemy = { ...createEnemyAI(getEnemyArchetype('goblin')), position: { x: 0, y: 0, z: 0 }, anchor: { x: 0, y: 0, z: 0 }, facingYaw: 0 }
  const spotted = updateEnemyAI(enemy, { x: 0, z: 5 }, 0.1, { canSeePlayer: true })
  assert.equal(spotted.mode, 'chase')
  assert.deepEqual(spotted.lastKnownPosition, { x: 0, z: 5 })
  const lost = updateEnemyAI(spotted, { x: 5, z: 0 }, 0.1, { canSeePlayer: false })
  assert.equal(lost.mode, 'search')
  assert.equal(lost.lastKnownPosition.z, 5)
  let returned = updateEnemyAI({ ...lost, awarenessTime: 0.01, position: { x: 4, y: 0, z: 5 } }, { x: 5, z: 0 }, 0.1, { canSeePlayer: false })
  returned = updateEnemyAI(returned, { x: 5, z: 0 }, 0.1, { canSeePlayer: false })
  assert.equal(returned.mode, 'return')
})

test('ranged enemies close in when far away and kite when the player enters minimum range', () => {
  const archer = createEnemyAI(getEnemyArchetype('darkArcher'), { x: 0, y: 0, z: 0 })
  const far = updateEnemyAI(archer, { x: 0, z: 15 }, 0.2, { canSeePlayer: true })
  assert.equal(far.mode, 'chase')
  assert.ok(far.position.z > 0)
  const tooClose = updateEnemyAI({ ...archer, position: { x: 0, y: 0, z: 5 } }, { x: 0, z: 0 }, 0.2, { canSeePlayer: true })
  assert.equal(tooClose.mode, 'reposition')
  assert.ok(tooClose.position.z > 5)
})

test('attack coordination caps new attackers and favors an existing telegraph and longer wait', () => {
  const make = (id, phase = 'idle', wait = 0) => ({
    ...createEnemyAI({ id, attackStyle: 'melee', attackRange: 3, minAttackRange: 0, aggroRange: 10, collisionRadius: 0.6, speed: 2, damage: 4, attackInterval: 1 }, { x: id === 'a' ? 1 : id === 'b' ? 2 : 3, y: 0, z: 0 }),
    attackPhase: phase,
    attackWaitTime: wait,
  })
  const a = make('a', 'telegraph')
  const b = make('b', 'idle', 2)
  const c = make('c', 'idle', 1)
  const granted = coordinateEnemyAttacks([a, b, c], { x: 0, z: 0 }, { maxConcurrent: 2 })
  assert.deepEqual([...granted].sort(), ['a', 'b'])
  const waiting = updateEnemyAI(c, { x: 0, z: 0 }, 0.2, { canSeePlayer: true, attackAllowed: false })
  assert.equal(waiting.attackPhase, 'idle')
  assert.ok(waiting.attackWaitTime > 0)
})

test('enemy separation nudges overlapping enemies apart without teleporting them', () => {
  const enemy = { id: 'goblin', speed: 3, collisionRadius: 0.8 }
  const before = { x: 0, y: 0, z: 0 }
  const after = applyEnemySeparation(enemy, before, [{ id: 'archer', collisionRadius: 0.7, position: { x: 0.2, y: 0, z: 0 } }], 0.1)
  assert.ok(after.x < before.x)
  assert.ok(Math.hypot(after.x - before.x, after.z - before.z) < 0.22)
  assert.deepEqual(applyEnemySeparation(enemy, before, [], 0.1), before)
})

test('encounter attack limits rise only after story milestones', () => {
  assert.equal(getEncounterAttackLimit({ objectives: { relic: false, sentinel: false, boss: false } }), 0)
  assert.equal(getEncounterAttackLimit({ objectives: { relic: true, sentinel: false, boss: false } }), 1)
  assert.equal(getEncounterAttackLimit({ objectives: { relic: true, sentinel: true, boss: false } }), 1)
  assert.equal(getEncounterAttackLimit({ objectives: { relic: true, sentinel: true, boss: true } }), 2)
})
