import assert from 'node:assert/strict'
import test from 'node:test'
import { findNearestInteraction } from './interactionDetection.js'
import { NPCS } from './npcs.js'
import { createInitialProgress } from './rpgProgression.js'

test('every added realm companion has a distinct identity, appearance, role, and dialogue choices', () => {
  const companions = Object.values(NPCS).filter(({ position }) => position)
  assert.equal(companions.length, 3)
  assert.equal(new Set(companions.map(({ name }) => name)).size, companions.length)
  assert.equal(new Set(companions.map(({ role }) => role)).size, companions.length)
  assert.equal(new Set(companions.map(({ appearance }) => appearance.robe)).size, companions.length)
  for (const npc of companions) {
    assert.ok(npc.options.length >= 2)
    assert.ok(npc.options.every(({ label }) => typeof label === 'string' && label.length > 0))
  }
})

test('the existing Keeper and new NPCs are valid nearby interaction targets', () => {
  const state = createInitialProgress()
  const keeper = { id: 'keeper', position: { x: -4.4, z: -4.5 }, radius: 0.62 }
  const targets = [
    keeper,
    ...Object.values(NPCS).filter(({ position }) => position).map((npc) => ({
      id: npc.id,
      position: npc.position,
      radius: 0.58,
    })),
  ]

  for (const target of targets) {
    assert.equal(findNearestInteraction(targets, target.position, state)?.id, target.id)
  }
})
