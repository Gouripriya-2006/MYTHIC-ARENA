import assert from 'node:assert/strict'
import test from 'node:test'
import { createEnemyAppearance } from '../enemyAppearance.js'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js'
import { Scene } from '@babylonjs/core/scene.js'
import { ENEMY_ARCHETYPES, getEnemyArchetype } from './enemyArchetypes.js'
import { createEnemyAI, createSentinelAI, updateEnemyAI } from './enemyAi.js'

test('Goblin Warrior has an independent fast melee archetype and uses shared AI timing', () => {
  const goblinDefinition = getEnemyArchetype('goblin')
  const goblin = createEnemyAI(goblinDefinition)
  const sentinel = createSentinelAI()

  assert.equal(goblin.name, 'Goblin Warrior')
  assert.equal(goblin.health, 72)
  assert.ok(goblin.speed > sentinel.speed)
  assert.equal(goblin.attackStyle, 'melee')
  assert.notEqual(goblin.position, goblin.anchor)

  const chase = updateEnemyAI(goblin, { x: goblin.position.x, z: goblin.position.z - 5 }, 0.2)
  assert.equal(chase.mode, 'chase')
  assert.ok(chase.position.z < goblin.position.z)
  const telegraph = updateEnemyAI({ ...goblin, attackCooldown: 0 }, goblin.position, 0.02)
  const active = updateEnemyAI(telegraph, goblin.position, goblin.attackTiming.telegraph)
  assert.equal(active.attackPhase, 'active')
  assert.equal(active.attackDamage, goblin.damage)
})

test('Goblin Warrior appearance builds a distinct non-skinned 3D silhouette', () => {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  const archetype = getEnemyArchetype('goblin')
  const model = createEnemyAppearance(scene, { ...archetype, position: archetype.position }, { addShadowCaster() {} })
  const meshes = model.root.getChildMeshes()
  const names = meshes.map(({ name }) => name)

  assert.ok(meshes.length >= 10)
  assert.ok(names.includes('goblin-green-head'))
  assert.ok(names.includes('goblin-pointed-ear-1'))
  assert.ok(names.includes('goblin-spiked-club'))
  assert.equal(scene.skeletons.length, 0)
  assert.equal(scene.animationGroups.length, 0)

  scene.dispose()
  engine.dispose()
})

test('every registered enemy archetype uses data fields consumed by the generic combat path', () => {
  assert.equal(ENEMY_ARCHETYPES.length, 5)
  assert.equal(new Set(ENEMY_ARCHETYPES.map(({ name }) => name)).size, 5)
  assert.equal(new Set(ENEMY_ARCHETYPES.map(({ appearance }) => appearance.silhouette)).size, 5)
  assert.equal(new Set(ENEMY_ARCHETYPES.map(({ health }) => health)).size, 5)
  assert.equal(new Set(ENEMY_ARCHETYPES.map(({ speed }) => speed)).size, 5)
  assert.equal(new Set(ENEMY_ARCHETYPES.map(({ attackRange }) => attackRange)).size, 5)
  for (const archetype of ENEMY_ARCHETYPES) {
    for (const field of ['id', 'name', 'health', 'speed', 'damage', 'attackRange', 'attackInterval', 'attackStyle', 'appearance']) {
      assert.notEqual(archetype[field], undefined, `${archetype.id} needs ${field}`)
    }
    if (archetype.attackStyle === 'ranged') {
      assert.ok(archetype.projectile)
      assert.ok(archetype.minAttackRange > 0)
    }
  }
})

test('every archetype builds its own visible mesh set without animation or skeleton assets', () => {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  const identities = []
  for (const archetype of ENEMY_ARCHETYPES) {
    const model = createEnemyAppearance(scene, { ...archetype, position: archetype.position }, { addShadowCaster() {} })
    const meshes = model.root.getChildMeshes()
    assert.ok(meshes.length >= 8, `${archetype.id} should have a multi-part silhouette`)
    assert.ok(meshes.every(({ name }) => typeof name === 'string' && name.length > 0), `${archetype.id} mesh names`)
    identities.push({ id: archetype.id, root: model.root.name, meshNames: new Set(meshes.map(({ name }) => name)) })
  }
  assert.equal(new Set(identities.map(({ root }) => root)).size, ENEMY_ARCHETYPES.length)
  for (let first = 0; first < identities.length; first += 1) {
    for (let second = first + 1; second < identities.length; second += 1) {
      assert.equal([...identities[first].meshNames].some((name) => identities[second].meshNames.has(name)), false,
        `${identities[first].id} and ${identities[second].id} should have separate named meshes`)
    }
  }
  assert.equal(scene.skeletons.length, 0)
  assert.equal(scene.animationGroups.length, 0)
  scene.dispose()
  engine.dispose()
})

test('ranged archetypes emit a projectile event through the same timed AI attack state machine', () => {
  for (const archetype of ENEMY_ARCHETYPES.filter(({ attackStyle }) => attackStyle === 'ranged')) {
    let enemy = { ...createEnemyAI(archetype), attackCooldown: 0 }
    enemy = updateEnemyAI(enemy, { x: enemy.position.x, z: enemy.position.z - archetype.attackRange + 1 }, 0.01)
    assert.equal(enemy.attackPhase, 'telegraph', archetype.id)
    enemy = updateEnemyAI(enemy, { x: enemy.position.x, z: enemy.position.z - archetype.attackRange + 1 }, archetype.attackTiming.telegraph)
    assert.equal(enemy.attackPhase, 'active', archetype.id)
    assert.equal(enemy.attackDamage, archetype.damage, archetype.id)
    assert.equal(enemy.attackStyle, 'ranged', archetype.id)
  }
})
