import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialProgress, createRpgProgressStore } from './rpgProgression.js'

function createMemoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('new players see the welcome tutorial while returning version-eight players are not interrupted', () => {
  const firstTime = createRpgProgressStore(undefined, createMemoryStorage(), { loadSaved: false }).getState()
  assert.deepEqual(firstTime.tutorial, { status: 'active', step: 0, confirmations: [] })

  const storage = createMemoryStorage()
  const returningSave = createInitialProgress({ classId: 'mage' })
  returningSave.version = 8
  delete returningSave.tutorial
  returningSave.gold = 123
  storage.setItem('mythic-arena-3d-save-v1', JSON.stringify(returningSave))

  const returning = createRpgProgressStore(undefined, storage).getState()
  assert.equal(returning.version, 10)
  assert.deepEqual(returning.tutorial, { status: 'not-started', step: 0, confirmations: [] })
  assert.equal(returning.gold, 123)
})

test('tutorial step confirmation is saved and only records actions for its current lesson', () => {
  const storage = createMemoryStorage()
  const store = createRpgProgressStore(undefined, storage, { loadSaved: false })
  store.dispatch({ type: 'tutorial-event', event: 'move' }, { persist: true })
  assert.deepEqual(store.getState().tutorial.confirmations, [])

  store.dispatch({ type: 'tutorial-next' }, { persist: true })
  store.dispatch({ type: 'tutorial-event', event: 'move' }, { persist: true })
  store.dispatch({ type: 'tutorial-event', event: 'sprint' }, { persist: true })
  assert.deepEqual(store.getState().tutorial.confirmations, ['move', 'sprint'])
  assert.deepEqual(createRpgProgressStore(undefined, storage).getState().tutorial, {
    status: 'active',
    step: 1,
    confirmations: ['move', 'sprint'],
  })
})

test('players can skip, then replay the complete tutorial from its welcome step', () => {
  const store = createRpgProgressStore(undefined, createMemoryStorage(), { loadSaved: false })
  store.dispatch({ type: 'tutorial-skip' })
  assert.equal(store.getState().tutorial.status, 'skipped')
  store.dispatch({ type: 'tutorial-replay' })
  assert.deepEqual(store.getState().tutorial, { status: 'active', step: 0, confirmations: [] })
  for (let step = 0; step < 7; step += 1) store.dispatch({ type: 'tutorial-next' })
  store.dispatch({ type: 'tutorial-next' })
  assert.equal(store.getState().tutorial.status, 'completed')
})
