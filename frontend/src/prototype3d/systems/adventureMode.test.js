import assert from 'node:assert/strict'
import test from 'node:test'
import { archiveCurrentSave, shouldStartNewAdventure } from './adventureMode.js'

test('an explicit new-adventure request starts fresh even when a saved character exists', () => {
  assert.equal(shouldStartNewAdventure(true, { hero: { name: 'Saved Wayfarer' } }), true)
  assert.equal(shouldStartNewAdventure(false, { hero: { name: 'Saved Wayfarer' } }), false)
  assert.equal(shouldStartNewAdventure(true, null), true)
})

test('starting fresh archives the exact existing save without deleting it', () => {
  const records = new Map([['save', '{"status":"defeat","health":0}']])
  const storage = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  }
  const archiveKey = archiveCurrentSave(storage, 'save', 123)
  assert.equal(archiveKey, 'save-archive-123')
  assert.equal(storage.getItem('save'), '{"status":"defeat","health":0}')
  assert.equal(storage.getItem(archiveKey), storage.getItem('save'))
})

test('save archives use a distinct key when a timestamp already exists', () => {
  const records = new Map([['save', 'current'], ['save-archive-123', 'earlier']])
  const storage = {
    getItem: (key) => records.get(key) ?? null,
    setItem: (key, value) => records.set(key, value),
  }
  assert.equal(archiveCurrentSave(storage, 'save', 123), 'save-archive-123-1')
  assert.equal(storage.getItem('save-archive-123'), 'earlier')
  assert.equal(storage.getItem('save-archive-123-1'), 'current')
})
