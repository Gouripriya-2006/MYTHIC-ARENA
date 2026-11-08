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

test('main quests require acceptance and unlock in order from the existing Keeper', () => {
  const store = createRpgProgressStore({ classId: 'warrior' }, createMemoryStorage(), { loadSaved: false })
  const initial = store.getState()
  assert.equal(store.dispatch({ type: 'accept-quest', questId: 'main-sun-relic', npcId: 'keeper' }), initial)

  const acceptedAndDone = store.dispatch({ type: 'accept-quest', questId: 'main-keepers-charge', npcId: 'keeper' })
  assert.ok(acceptedAndDone.questLog.completed.includes('main-keepers-charge'))
  assert.equal(acceptedAndDone.gold, 15)
  assert.equal(acceptedAndDone.xp, 25)
  assert.equal(store.getState().questLog.completed.includes('main-sun-relic'), false)

  const relicQuest = store.dispatch({ type: 'accept-quest', questId: 'main-sun-relic', npcId: 'keeper' })
  assert.ok(relicQuest.questLog.active.includes('main-sun-relic'))
  assert.equal(relicQuest.questLog.trackedId, 'main-sun-relic')
})

test('tracks enemy objective progress and completes a multi-objective side quest with one reward', () => {
  const store = createRpgProgressStore({ classId: 'mage' }, createMemoryStorage(), { loadSaved: false })
  store.dispatch({ type: 'accept-quest', questId: 'side-hunters-trail', npcId: 'keeper' })
  store.dispatch({ type: 'damage-enemy', enemyId: 'goblin', amount: 10 })
  assert.equal(store.getState().questLog.progress['side-hunters-trail'].goblin, 0)
  store.dispatch({ type: 'damage-enemy', enemyId: 'goblin', amount: 72 })
  assert.equal(store.getState().questLog.progress['side-hunters-trail'].goblin, 1)
  assert.ok(store.getState().questLog.active.includes('side-hunters-trail'))

  const completed = store.dispatch({ type: 'damage-enemy', enemyId: 'darkArcher', amount: 88 })
  assert.ok(completed.questLog.completed.includes('side-hunters-trail'))
  assert.ok(completed.skillPoints >= 1)
  assert.equal(completed.gold, 70)
  assert.ok(completed.xp >= 90)
  assert.equal(store.dispatch({ type: 'damage-enemy', enemyId: 'darkArcher', amount: 88 }), completed)
})

test('side quests remain independently available and discoveries can count before acceptance', () => {
  const store = createRpgProgressStore({ classId: 'guardian' }, createMemoryStorage(), { loadSaved: false })
  store.dispatch({ type: 'quest-location', locationId: 'bridge' })
  store.dispatch({ type: 'accept-quest', questId: 'side-bridge-survey', npcId: 'keeper' })
  assert.ok(store.getState().questLog.completed.includes('side-bridge-survey'))
  assert.ok(store.getState().inventory.some(({ id }) => id === 'mana-potion'))

  const current = store.getState()
  const withOtherSideQuest = store.dispatch({ type: 'accept-quest', questId: 'side-hidden-cache', npcId: 'keeper' })
  assert.notEqual(withOtherSideQuest, current)
  assert.ok(withOtherSideQuest.questLog.active.includes('side-hidden-cache'))
})

test('collecting cache completes its objective and grants the item and rewards exactly once', () => {
  const store = createRpgProgressStore({ classId: 'warrior' }, createMemoryStorage(), { loadSaved: false })
  store.dispatch({ type: 'accept-quest', questId: 'side-hidden-cache', npcId: 'keeper' })
  const completed = store.dispatch({ type: 'collect-cache' })
  assert.ok(completed.questLog.completed.includes('side-hidden-cache'))
  assert.ok(completed.inventory.some(({ id }) => id === 'ancient-cache'))
  assert.equal(completed.gold, 80)
  assert.equal(completed.xp, 90)
  assert.ok(completed.inventory.some(({ id }) => id === 'health-potion' && id !== 'missing'))
  assert.equal(store.dispatch({ type: 'collect-cache' }), completed)
})

test('holds quest item rewards when inventory is full and allows claiming once space is made', () => {
  const store = createRpgProgressStore({ classId: 'warrior' }, createMemoryStorage(), { loadSaved: false })
  const fullInventory = Array.from({ length: 30 }, (_, index) => ({
    id: `test-keepsake-${index}`,
    name: `Keepsake ${index}`,
    type: 'material',
    quantity: 1,
  }))
  const full = store.dispatch({ type: 'restore', progress: { ...store.getState(), inventory: fullInventory } })
  store.dispatch({ type: 'accept-quest', questId: 'side-hidden-cache', npcId: 'keeper' })
  const completed = store.dispatch({ type: 'quest-event', eventType: 'interact', targetId: 'cache' })
  assert.ok(completed.questLog.pendingItems['side-hidden-cache'])
  assert.equal(store.dispatch({ type: 'claim-quest-items', questId: 'side-hidden-cache' }), completed)

  const space = store.dispatch({ type: 'discard-item', itemId: 'test-keepsake-0' })
  const claimed = store.dispatch({ type: 'claim-quest-items', questId: 'side-hidden-cache' })
  assert.ok(claimed.inventory.some(({ id }) => id === 'health-potion'))
  assert.equal(claimed.questLog.pendingItems['side-hidden-cache'], undefined)
  assert.equal(store.dispatch({ type: 'claim-quest-items', questId: 'side-hidden-cache' }), claimed)
  assert.notEqual(space, completed)
})

test('persists active quest, tracking and objective progress across save/load', () => {
  const storage = createMemoryStorage()
  const store = createRpgProgressStore({ classId: 'warrior' }, storage, { loadSaved: false })
  store.dispatch({ type: 'accept-quest', questId: 'side-hunters-trail', npcId: 'keeper' }, { persist: true })
  store.dispatch({ type: 'damage-enemy', enemyId: 'goblin', amount: 72 }, { persist: true })
  store.dispatch({ type: 'track-quest', questId: 'side-hunters-trail' }, { persist: true })

  const loaded = createRpgProgressStore(undefined, storage).getState()
  assert.deepEqual(loaded.questLog.active, ['side-hunters-trail'])
  assert.equal(loaded.questLog.trackedId, 'side-hunters-trail')
  assert.equal(loaded.questLog.progress['side-hunters-trail'].goblin, 1)
})

test('migrates version 7 saves without losing character, skill, inventory, equipment or boss progress', () => {
  const storage = createMemoryStorage()
  const oldSave = createInitialProgress({
    name: 'Astra',
    classId: 'mage',
    gender: 'female',
    appearance: { outfitId: 'astral' },
  })
  oldSave.version = 7
  delete oldSave.questLog
  oldSave.level = 5
  oldSave.skillPoints = 2
  oldSave.unlockedSkills = ['mage-focus-1']
  oldSave.skills.focus = 1
  oldSave.inventory = [{ id: 'sun-relic', name: 'Sun Relic', type: 'quest' }]
  oldSave.equipment.mainHand = 'mage-staff'
  oldSave.objectives.briefing = true
  oldSave.objectives.relic = true
  oldSave.objectives.sentinel = true
  oldSave.enemies.sentinel.defeated = true
  oldSave.enemies.sentinel.health = 0
  oldSave.enemies.boss.health = 130
  oldSave.enemies.boss.phase = 2
  storage.setItem('mythic-arena-3d-save-v1', JSON.stringify(oldSave))

  const migrated = createRpgProgressStore(undefined, storage).getState()
  assert.equal(migrated.version, 10)
  assert.equal(migrated.hero.name, 'Astra')
  assert.equal(migrated.hero.appearance.outfitId, 'astral')
  assert.deepEqual(migrated.unlockedSkills, ['mage-focus-1'])
  assert.equal(migrated.skillPoints, 2)
  assert.ok(migrated.inventory.some(({ id }) => id === 'sun-relic'))
  assert.equal(migrated.equipment.mainHand, 'mage-staff')
  assert.deepEqual(migrated.questLog.completed, ['main-keepers-charge', 'main-sun-relic', 'main-sentinel'])
  assert.deepEqual(migrated.questLog.active, ['main-warden'])
  assert.equal(migrated.questLog.progress['main-keepers-charge'].keeper, 1)
  assert.equal(migrated.enemies.boss.health, 130)
  assert.equal(migrated.enemies.boss.phase, 2)
  assert.deepEqual(JSON.parse(storage.getItem('mythic-arena-3d-save-v1')).questLog.active, ['main-warden'])
})

test('normalizes missing and invalid quest log data safely', () => {
  const storage = createMemoryStorage()
  const invalid = createInitialProgress({ classId: 'warrior' })
  invalid.questLog = {
    active: ['not-a-quest', 'main-warden'],
    completed: ['main-keepers-charge', 'main-keepers-charge'],
    trackedId: 'not-a-quest',
    progress: { 'main-warden': { warden: -4, unknown: 99 } },
    rewarded: ['not-a-quest'],
    pendingItems: { 'main-warden': [{ itemId: 'sun-relic', quantity: -1 }] },
  }
  storage.setItem('mythic-arena-3d-save-v1', JSON.stringify(invalid))
  const loaded = createRpgProgressStore(undefined, storage).getState()
  assert.deepEqual(loaded.questLog.active, [])
  assert.deepEqual(loaded.questLog.completed, ['main-keepers-charge'])
  assert.equal(loaded.questLog.trackedId, null)
  assert.deepEqual(loaded.questLog.pendingItems, {})

  const missing = createInitialProgress({ classId: 'warrior' })
  delete missing.questLog
  storage.setItem('mythic-arena-3d-save-v1', JSON.stringify(missing))
  assert.deepEqual(createRpgProgressStore(undefined, storage).getState().questLog.active, [])
})
