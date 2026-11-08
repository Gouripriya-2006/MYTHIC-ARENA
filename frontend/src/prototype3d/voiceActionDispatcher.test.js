import test from 'node:test'
import assert from 'node:assert/strict'
import { createBabylonVoiceActionDispatcher } from './voiceActionDispatcher.js'

const intent = (action, parameters = {}) => ({ version: 1, game: 'babylon-3d', action, parameters })

test('Babylon dispatcher validates live state and delegates approved actions to existing handlers', () => {
  const state = { status: 'active' }
  const executed = []
  const dispatcher = createBabylonVoiceActionDispatcher({
    getState: () => state,
    canExecute: () => true,
    execute: (action) => executed.push(action),
  })
  assert.equal(dispatcher.dispatch(intent('heavy_attack')).ok, true)
  assert.deepEqual(executed.map(({ action }) => action), ['heavy_attack'])
})

test('Babylon dispatcher rejects stale state, invalid inventory ids and non-allowlisted actions', () => {
  let executed = 0
  const state = { status: 'defeat' }
  const dispatcher = createBabylonVoiceActionDispatcher({
    getState: () => state,
    canExecute: () => true,
    execute: () => { executed += 1 },
  })
  assert.equal(dispatcher.dispatch(intent('light_attack')).ok, false)
  state.status = 'active'
  assert.equal(dispatcher.dispatch(intent('use_consumable', { itemId: 'health-potion', amount: 999 })).ok, false)
  assert.equal(dispatcher.dispatch(intent('teleport')).ok, false)
  assert.equal(executed, 0)
})
