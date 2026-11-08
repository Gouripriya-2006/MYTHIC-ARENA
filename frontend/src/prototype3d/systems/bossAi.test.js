import assert from 'node:assert/strict'
import test from 'node:test'
import { BOSS_ATTACKS, createLostKingdomBoss, updateBossAI } from './bossAi.js'

const playerAtBoss = { x: 0, z: 40 }

function runTelegraph(boss, pattern, phase) {
  let current = {
    ...boss,
    phase,
    attackPattern: pattern,
    attackPhase: 'telegraph',
    attackPhaseTime: 0,
    attackCooldown: 2,
    attackTarget: { x: 0, z: 39 },
    dashDestination: pattern === 'shadow-dash' ? { x: 0, z: 38 } : null,
  }
  const definition = BOSS_ATTACKS[pattern]
  current = updateBossAI(current, playerAtBoss, phase === 1 ? 0.9 : phase === 2 ? 0.6 : 0.3, definition.timing.telegraph)
  return current
}

test('health thresholds transition through three phases once and reset into a fair transition cooldown', () => {
  let boss = createLostKingdomBoss()
  boss = updateBossAI(boss, playerAtBoss, 0.71, 0.01)
  assert.equal(boss.phase, 1)
  assert.equal(boss.phaseChanged, false)

  boss = updateBossAI(boss, playerAtBoss, 0.7, 0.01)
  assert.equal(boss.phase, 2)
  assert.equal(boss.phaseChanged, true)
  assert.equal(boss.attackPhase, 'idle')
  assert.ok(boss.attackCooldown >= 1.3)
  boss = updateBossAI(boss, playerAtBoss, 0.69, 0.01)
  assert.equal(boss.phaseChanged, false)

  boss = updateBossAI(boss, playerAtBoss, 0.4, 0.01)
  assert.equal(boss.phase, 3)
  assert.equal(boss.phaseChanged, true)
})

test('phase one Shadow Slash has a readable telegraph, one active hit, and a recovery cooldown', () => {
  let boss = { ...createLostKingdomBoss(), attackCooldown: 0 }
  boss = updateBossAI(boss, playerAtBoss, 0.9, 0.01)
  assert.equal(boss.attackStarted, true)
  assert.equal(boss.attackPattern, 'shadow-slash')
  assert.equal(boss.attackPhase, 'telegraph')
  assert.equal(boss.attackDamage, 0)
  assert.ok(BOSS_ATTACKS[boss.attackPattern].timing.telegraph >= 0.8)
  assert.ok(BOSS_ATTACKS[boss.attackPattern].warning.length > 0)

  boss = updateBossAI(boss, playerAtBoss, 0.9, BOSS_ATTACKS['shadow-slash'].timing.telegraph)
  assert.equal(boss.attackPhase, 'active')
  assert.equal(boss.attackDamage, BOSS_ATTACKS['shadow-slash'].damage)
  assert.ok(boss.attackCooldown > 0)
  assert.ok(boss.attackCooldown < BOSS_ATTACKS['shadow-slash'].cooldown)
  boss = updateBossAI(boss, playerAtBoss, 0.9, 0.05)
  assert.equal(boss.attackDamage, 0)
  boss = updateBossAI(boss, playerAtBoss, 0.9, 0.2)
  assert.equal(boss.attackPhase, 'recovery')
  boss = updateBossAI(boss, playerAtBoss, 0.9, 1.2)
  assert.equal(boss.attackPhase, 'idle')
  assert.equal(boss.attackStarted, false)
  assert.ok(boss.attackCooldown > 0)
})

test('phase two cycles Veil Wave and Flame Burst with distinct ground-target semantics', () => {
  let boss = { ...createLostKingdomBoss(), phase: 2, attackCooldown: 0 }
  boss = updateBossAI(boss, playerAtBoss, 0.6, 0.01)
  assert.equal(boss.attackPattern, 'veil-wave')
  assert.equal(boss.attackPhase, 'telegraph')
  assert.equal(BOSS_ATTACKS['veil-wave'].kind, 'radial')
  assert.ok(BOSS_ATTACKS['veil-wave'].radius > BOSS_ATTACKS['flame-burst'].radius)

  boss = runTelegraph(boss, 'veil-wave', 2)
  assert.equal(boss.attackPhase, 'active')
  assert.equal(boss.attackDamage, BOSS_ATTACKS['veil-wave'].damage)

  let flame = { ...createLostKingdomBoss(), phase: 2, attackCooldown: 0, attackIndex: 1 }
  flame = updateBossAI(flame, playerAtBoss, 0.6, 0.01)
  assert.equal(flame.attackPattern, 'flame-burst')
  assert.deepEqual(flame.attackTarget, playerAtBoss)
  assert.equal(BOSS_ATTACKS[flame.attackPattern].kind, 'targeted')
})

test('phase three Shadow Dash repositions before striking and Final Fury is telegraphed', () => {
  let boss = { ...createLostKingdomBoss(), phase: 3, attackCooldown: 0 }
  boss = updateBossAI(boss, playerAtBoss, 0.3, 0.01)
  assert.equal(boss.attackPattern, 'shadow-dash')
  const before = boss.position
  boss = updateBossAI(boss, playerAtBoss, 0.3, 0.95)
  assert.equal(boss.attackPhase, 'active')
  assert.equal(boss.attackDamage, BOSS_ATTACKS['shadow-dash'].damage)
  assert.notDeepEqual(boss.position, before)

  const fury = runTelegraph({ ...createLostKingdomBoss(), phase: 3 }, 'final-fury', 3)
  assert.equal(fury.attackPhase, 'active')
  assert.equal(fury.attackDamage, BOSS_ATTACKS['final-fury'].damage)
  assert.ok(BOSS_ATTACKS['final-fury'].timing.telegraph >= 1)
})

test('boss chases inside the arena and stops attacking after a saved defeat', () => {
  const boss = createLostKingdomBoss()
  const chasing = updateBossAI(boss, { x: 0, z: 48 }, 1, 0.5)
  assert.equal(chasing.mode, 'stalk')
  assert.ok(chasing.position.z > 40)
  assert.ok(Math.hypot(chasing.position.x, chasing.position.z - 40) <= 17.5)
  const defeated = updateBossAI({ ...boss, defeated: true }, boss.position, 0, 1)
  assert.equal(defeated.attackDamage, 0)
  assert.equal(defeated.attackStarted, false)
})

test('boss returns to its guard point after its awareness of the player expires', () => {
  let boss = createLostKingdomBoss()
  boss = updateBossAI(boss, { x: 0, z: 15 }, 1, 0.1, { canSeePlayer: true })
  assert.equal(boss.mode, 'stalk')
  boss = { ...boss, awarenessTime: 0.01, position: { x: 0, y: 0, z: 20 } }
  boss = updateBossAI(boss, { x: 0, z: 0 }, 1, 0.1, { canSeePlayer: false })
  boss = updateBossAI(boss, { x: 0, z: 0 }, 1, 0.1, { canSeePlayer: false })
  assert.equal(boss.mode, 'return')
  assert.ok(boss.position.z > 20 && boss.position.z < 40)
})
