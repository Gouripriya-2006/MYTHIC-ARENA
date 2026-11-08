import assert from 'node:assert/strict'
import test from 'node:test'
import { createGameStore } from './gameStore.js'
import { createInitialState } from './initialState.js'

const customHero = {
  name: 'Astra',
  gender: 'female',
  classId: 'mage',
  appearance: {
    faceId: 'marked',
    hairstyleId: 'braided',
    skinToneId: 'deep',
    outfitId: 'astral',
  },
}

test('stores the complete custom hero while retaining selected class stats', () => {
  const store = createGameStore(customHero)
  const state = store.getState()

  assert.deepEqual(state.hero, customHero)
  assert.equal(state.characterId, 'mage')
  assert.equal(state.health, 80)
  store.recoverRelic()
  store.attackSentinel()
  assert.equal(store.getState().sentinelHealth, 48)
})

test('requires a valid custom hero name', () => {
  assert.throws(() => createInitialState({ ...customHero, name: '   ' }), /Hero name is required/)
  assert.throws(() => createInitialState({ ...customHero, name: 'A'.repeat(25) }), /24 characters/)
})

test('rejects invalid hero appearance or gender values', () => {
  assert.throws(() => createInitialState({ ...customHero, gender: 'other' }), /Unknown hero gender/)
  assert.throws(() => createInitialState({
    ...customHero,
    appearance: { ...customHero.appearance, outfitId: 'unknown' },
  }), /Unknown outfitId/)
})

test('preserves legacy class-only creation with its default hero name', () => {
  const state = createInitialState('guardian')
  assert.equal(state.hero.name, 'Guardian')
  assert.equal(state.hero.classId, 'guardian')
  assert.equal(state.health, 150)
})

test('runs the existing relic, combat, and gate objectives to victory', () => {
  const store = createGameStore(customHero)
  store.reachGate()
  assert.equal(store.getState().objectives.gate, false)

  store.recoverRelic()
  store.attackSentinel()
  store.attackSentinel()
  store.attackSentinel()
  assert.equal(store.getState().objectives.sentinel, true)
  store.reachGate()
  assert.equal(store.getState().objectives.gate, true)
  assert.equal(store.getState().status, 'victory')
})

test('defeating the active Sentinel completes its existing objective exactly once', () => {
  const store = createGameStore(customHero)
  store.recoverRelic()
  let completions = 0
  store.subscribe((state) => {
    if (state.objectives.sentinel) completions += 1
  })

  store.defeatSentinel()
  store.defeatSentinel()

  assert.equal(store.getState().sentinelHealth, 0)
  assert.equal(store.getState().objectives.sentinel, true)
  assert.equal(completions, 1)
})


