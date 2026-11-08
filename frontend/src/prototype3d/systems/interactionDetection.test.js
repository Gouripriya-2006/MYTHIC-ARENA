import assert from 'node:assert/strict'
import test from 'node:test'
import { findNearestInteraction } from './interactionDetection.js'
import { createInitialProgress, createRpgProgressStore } from './rpgProgression.js'

test('detects the Keeper using the player and NPC collision surfaces', () => {
  const keeper = {
    id: 'keeper',
    label: 'Speak with the Veil Keeper',
    position: { x: -4.4, y: 0, z: -4.5 },
    radius: 0.62,
  }
  const state = createInitialProgress()

  assert.equal(findNearestInteraction([keeper], { x: -0.8, y: 0, z: -4.5 }, state)?.id, 'keeper')
  assert.equal(findNearestInteraction([keeper], { x: 0.1, y: 0, z: -4.5 }, state), null)
})

test('Keeper interaction activates and tracks the first main quest with its interaction reward', () => {
  const store = createRpgProgressStore({ classId: 'warrior' }, undefined, { loadSaved: false })
  const keeper = {
    id: 'keeper',
    position: { x: -4.4, y: 0, z: -4.5 },
    radius: 0.62,
  }
  const target = findNearestInteraction(
    [keeper],
    { x: -0.8, y: 0, z: -4.5 },
    store.getState(),
  )

  assert.equal(target?.id, 'keeper')
  const interacted = store.dispatch({ type: 'briefing' })
  assert.equal(interacted.objectives.briefing, true)
  assert.ok(interacted.questLog.completed.includes('main-keepers-charge'))
  assert.equal(interacted.questLog.trackedId, 'main-keepers-charge')
  assert.equal(interacted.gold, 15)
  assert.equal(interacted.xp, 25)
})
