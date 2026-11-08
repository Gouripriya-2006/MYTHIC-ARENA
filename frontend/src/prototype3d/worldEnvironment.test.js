import assert from 'node:assert/strict'
import test from 'node:test'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js'
import { Scene } from '@babylonjs/core/scene.js'
import {
  createEnemyCamps,
  createForest,
  createGate,
  createHiddenCache,
  createKeeper,
  createMaterials,
  createOuterRuins,
  createRelic,
  createSanctum,
  createWorldLandmarks,
} from './arenaScene.js'
import { createRiverCollisionBounds, isWorldPositionWalkable } from './environmentCollision.js'
import { createSentinelAI } from './systems/enemyAi.js'
import { createLostKingdomBoss } from './systems/bossAi.js'

function createWorldFixture() {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  const materials = createMaterials(scene)
  const shadows = { addShadowCaster() {} }
  const colliders = []
  const bounds = createRiverCollisionBounds()
  createSanctum(scene, materials, shadows, colliders)
  createForest(scene, materials, shadows, colliders)
  createWorldLandmarks(scene, materials, shadows, colliders, bounds)
  createOuterRuins(scene, materials, shadows, colliders, bounds)
  createEnemyCamps(scene, materials, shadows, colliders, bounds)
  const relic = createRelic(scene, materials, colliders)
  const keeper = createKeeper(scene, materials, shadows, colliders)
  const gate = createGate(scene, materials, shadows, colliders)
  const cache = createHiddenCache(scene, materials, colliders, bounds)
  return { engine, scene, colliders, bounds, relic, keeper, gate, cache }
}

test('environment builders retain quest landmarks and encounter coordinates', () => {
  const world = createWorldFixture()
  assert.deepEqual(world.relic.position.asArray(), [0, 0, 9])
  assert.deepEqual(world.keeper.position.asArray(), [-4.4, 0, -4.5])
  assert.deepEqual(world.gate.position.asArray(), [0, 0, 52])
  assert.deepEqual(world.cache.position.asArray(), [21, 0, 14])
  assert.deepEqual(createSentinelAI().position, { x: 0, y: 0, z: 24 })
  assert.deepEqual(createLostKingdomBoss().position, { x: 0, y: 0, z: 40 })
  world.scene.dispose(); world.engine.dispose()
})

test('forest expansion uses reusable mesh instances and preserves collision trunks', () => {
  const world = createWorldFixture()
  const trunks = world.scene.meshes.filter(({ name }) => name.startsWith('sacred-tree-trunk-'))
  const crowns = world.scene.meshes.filter(({ name }) => name.startsWith('sacred-tree-crown-'))
  const underbrush = world.scene.meshes.filter(({ name }) => name.startsWith('forest-underbrush-'))
  assert.ok(trunks.length >= 30, `expected expanded tree coverage, got ${trunks.length}`)
  assert.ok(crowns.length >= trunks.length * 2)
  assert.ok(underbrush.length >= 20)
  assert.ok(trunks.some(({ getClassName }) => getClassName() === 'InstancedMesh'))
  assert.ok(world.colliders.length >= trunks.length)
  world.scene.dispose(); world.engine.dispose()
})

test('ruins, camps, cache, and waterfall create colliders while keeping the main route usable', () => {
  const world = createWorldFixture()
  assert.ok(world.bounds.length >= 8)
  assert.ok(world.scene.getMeshByName('waterfall-runoff-stream'))
  assert.ok(world.scene.getMeshByName('waterfall-flow-ribbon-0'))
  assert.ok(world.scene.getMeshByName('western-archive-ruin'))
  assert.ok(world.scene.getMeshByName('goblin-camp-hide--1'))
  assert.ok(world.scene.getMeshByName('hidden-cache-sun-clasp'))

  for (const z of [-7, 9, 20, 24, 32, 40, 52]) {
    assert.equal(isWorldPositionWalkable(4, z, {
      circleColliders: world.colliders,
      boxColliders: world.bounds,
    }), true, `quest corridor should remain clear near z=${z}`)
  }
  assert.equal(isWorldPositionWalkable(31, 0, { boxColliders: world.bounds }), false)
  assert.equal(isWorldPositionWalkable(31, 20, {
    circleColliders: world.colliders,
    boxColliders: world.bounds,
  }), true, 'the existing bridge crossing should remain open')
  assert.equal(isWorldPositionWalkable(0, 6, {
    circleColliders: world.colliders,
    boxColliders: world.bounds,
  }), true, 'the relic should remain approachable')
  assert.equal(isWorldPositionWalkable(21, 11, {
    circleColliders: world.colliders,
    boxColliders: world.bounds,
  }), true, 'the hidden cache should remain approachable')
  world.scene.dispose(); world.engine.dispose()
})
