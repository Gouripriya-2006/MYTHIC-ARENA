import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialProgress, createRpgProgressStore, loadProgress } from './rpgProgression.js'
import { ENEMY_ARCHETYPES, ENEMY_REWARDS } from './enemyArchetypes.js'

function createMemoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('preserves selected class and appearance and gives class-specific stats', () => {
  const progress = createInitialProgress({
    name: 'Astra',
    classId: 'mage',
    gender: 'female',
    appearance: { hairstyleId: 'braided', outfitId: 'astral' },
  })

  assert.equal(progress.hero.name, 'Astra')
  assert.equal(progress.hero.gender, 'female')
  assert.equal(progress.health, 80)
  assert.equal(progress.maxStamina, 130)
  assert.equal(progress.hero.appearance.outfitId, 'astral')
})

test('returning from defeat restores health and active gameplay while preserving progress', () => {
  const storage = createMemoryStorage()
  const store = createRpgProgressStore({ name: 'Saved Wayfarer', classId: 'mage' }, storage, { loadSaved: false })
  store.dispatch({ type: 'collect-relic' }, { persist: true })
  store.dispatch({ type: 'damage-player', amount: 500 }, { persist: true })
  const defeated = store.getState()
  assert.equal(defeated.status, 'defeat')
  assert.equal(defeated.health, 0)

  store.dispatch({ type: 'resume-after-defeat' }, { persist: true })
  const recovered = store.getState()
  assert.equal(recovered.status, 'active')
  assert.equal(recovered.health, recovered.maxHealth)
  assert.equal(recovered.hero.name, 'Saved Wayfarer')
  assert.equal(recovered.objectives.relic, true)
  assert.deepEqual(createRpgProgressStore(undefined, storage).getState(), recovered)
})

test('gates mission completion on collecting the relic and defeating the sentinel', () => {
  const storage = createMemoryStorage()
  const store = createRpgProgressStore(undefined, storage)

  store.dispatch({ type: 'open-gate' })
  assert.equal(store.getState().status, 'active')
  store.dispatch({ type: 'collect-relic' }, { persist: true })
  store.dispatch({ type: 'damage-enemy', enemyId: 'sentinel', amount: 100 }, { persist: true })
  assert.equal(store.getState().objectives.sentinel, true)
  assert.equal(store.getState().gold, 25)
  assert.equal(store.getState().enemyRewards.sentinel.pending, true)
  store.dispatch({ type: 'collect-enemy-reward', enemyId: 'sentinel' }, { persist: true })
  assert.equal(store.getState().gold, 60)
  store.dispatch({ type: 'collect-enemy-reward', enemyId: 'sentinel' })
  assert.equal(store.getState().gold, 60)
  store.dispatch({ type: 'open-gate' })
  assert.equal(store.getState().status, 'active')
  store.dispatch({ type: 'damage-enemy', enemyId: 'boss', amount: 260 }, { persist: true })
  store.dispatch({ type: 'open-gate' }, { persist: true })
  assert.equal(store.getState().status, 'victory')
  assert.equal(store.getState().gold, 335)
  assert.equal(store.getState().enemyRewards.boss.collected, true)
  assert.equal(createRpgProgressStore(undefined, storage).getState().status, 'victory')
})

test('boss phase thresholds persist without resetting health and the defeat reward can only be collected once', () => {
  const storage = createMemoryStorage()
  const store = createRpgProgressStore({ classId: 'warrior' }, storage, { loadSaved: false })
  store.dispatch({ type: 'damage-enemy', enemyId: 'boss', amount: 78 }, { persist: true })
  assert.equal(store.getState().enemies.boss.health, 182)
  assert.equal(store.getState().enemies.boss.phase, 2)

  store.dispatch({ type: 'damage-enemy', enemyId: 'boss', amount: 79 }, { persist: true })
  assert.equal(store.getState().enemies.boss.health, 103)
  assert.equal(store.getState().enemies.boss.phase, 3)
  const loaded = createRpgProgressStore(undefined, storage).getState()
  assert.equal(loaded.enemies.boss.health, 103)
  assert.equal(loaded.enemies.boss.phase, 3)

  const gold = loaded.gold
  store.dispatch({ type: 'damage-enemy', enemyId: 'boss', amount: 103 }, { persist: true })
  assert.equal(store.getState().enemyRewards.boss.pending, true)
  const rewardGold = store.getState().gold
  store.dispatch({ type: 'collect-enemy-reward', enemyId: 'boss' }, { persist: true })
  assert.equal(store.getState().gold, rewardGold + ENEMY_REWARDS.boss.gold)
  store.dispatch({ type: 'collect-enemy-reward', enemyId: 'boss' }, { persist: true })
  assert.equal(store.getState().gold, rewardGold + ENEMY_REWARDS.boss.gold)
  assert.ok(store.getState().gold >= gold)
  assert.equal(createRpgProgressStore(undefined, storage).getState().enemyRewards.boss.collected, true)
})

test('Goblin Warrior uses persistent health and a one-time collectible gold reward without changing story gates', () => {
  const storage = createMemoryStorage()
  const store = createRpgProgressStore({ classId: 'warrior' }, storage, { loadSaved: false })
  store.dispatch({ type: 'collect-relic' })
  store.dispatch({ type: 'damage-enemy', enemyId: 'goblin', amount: 72 }, { persist: true })
  assert.equal(store.getState().enemies.goblin.defeated, true)
  assert.equal(store.getState().objectives.sentinel, false)
  assert.equal(store.getState().enemyRewards.goblin.pending, true)
  const goldBeforePickup = store.getState().gold

  store.dispatch({ type: 'collect-enemy-reward', enemyId: 'goblin' }, { persist: true })
  assert.equal(store.getState().gold, goldBeforePickup + 15)
  store.dispatch({ type: 'collect-enemy-reward', enemyId: 'goblin' })
  assert.equal(store.getState().gold, goldBeforePickup + 15)
  assert.equal(createRpgProgressStore(undefined, storage).getState().enemyRewards.goblin.collected, true)
})

test('each optional archetype retains its individual health and pays its configured reward exactly once', () => {
  const store = createRpgProgressStore({ classId: 'warrior' }, createMemoryStorage(), { loadSaved: false })
  store.dispatch({ type: 'collect-relic' })

  for (const archetype of ENEMY_ARCHETYPES) {
    const before = store.getState()
    assert.equal(before.enemies[archetype.id].maxHealth, archetype.health)
    store.dispatch({ type: 'damage-enemy', enemyId: archetype.id, amount: archetype.health })
    assert.equal(store.getState().enemies[archetype.id].defeated, true)
    assert.equal(store.getState().enemyRewards[archetype.id].pending, true)
    const gold = store.getState().gold
    store.dispatch({ type: 'collect-enemy-reward', enemyId: archetype.id })
    assert.equal(store.getState().gold, gold + ENEMY_REWARDS[archetype.id].gold)
    store.dispatch({ type: 'collect-enemy-reward', enemyId: archetype.id })
    assert.equal(store.getState().gold, gold + ENEMY_REWARDS[archetype.id].gold)
  }
  assert.equal(store.getState().objectives.sentinel, false)
  assert.equal(store.getState().objectives.boss, false)
})

test('rejects invalid actions and clamps health and stamina to their limits', () => {
  const store = createRpgProgressStore({ classId: 'warrior' }, createMemoryStorage())
  const health = store.getState().health
  store.dispatch({ type: 'damage-player', amount: -5 })
  store.dispatch({ type: 'heal-player', amount: 500 })
  store.dispatch({ type: 'spend-stamina', amount: 500 })
  store.dispatch({ type: 'regenerate-stamina', amount: 500 })
  assert.equal(store.getState().health, health)
  assert.equal(store.getState().stamina, store.getState().maxStamina)
})

test('levels up, rewards gold, and saves the hero and inventory', () => {
  const storage = createMemoryStorage()
  const store = createRpgProgressStore({ name: 'Astra', classId: 'mage' }, storage)
  store.dispatch({ type: 'collect-relic' })
  store.dispatch({ type: 'damage-enemy', enemyId: 'sentinel', amount: 100 }, { persist: true })
  store.dispatch({ type: 'damage-enemy', enemyId: 'boss', amount: 260 }, { persist: true })
  const loaded = createRpgProgressStore({ classId: 'warrior' }, storage).getState()
  assert.equal(loaded.hero.name, 'Astra')
  assert.ok(loaded.level > 1)
  assert.ok(loaded.inventory.some(({ id }) => id === 'sun-relic'))
  assert.ok(loaded.inventory.some(({ id }) => id === 'mage-staff'))
})

test('reopening the 3D progress store restores gameplay, inventory, quest, and boss state', () => {
  const storage = createMemoryStorage()
  const store = createRpgProgressStore({ name: 'Saved Wayfarer', classId: 'warrior' }, storage, { loadSaved: false })
  store.dispatch({ type: 'accept-quest', questId: 'main-keepers-charge', npcId: 'keeper' }, { persist: true })
  store.dispatch({ type: 'accept-quest', questId: 'main-sun-relic', npcId: 'keeper' }, { persist: true })
  store.dispatch({ type: 'collect-relic' }, { persist: true })
  store.dispatch({ type: 'damage-enemy', enemyId: 'sentinel', amount: 100 }, { persist: true })
  store.dispatch({ type: 'damage-enemy', enemyId: 'boss', amount: 78 }, { persist: true })
  store.dispatch({ type: 'heal-player', amount: 17 }, { persist: true })
  store.dispatch({ type: 'move', position: { x: 4, y: 0, z: 31 } }, { persist: true })
  const beforeReload = store.getState()

  const loaded = createRpgProgressStore({ name: 'Different New Hero', classId: 'mage' }, storage).getState()
  assert.equal(loaded.hero.name, 'Saved Wayfarer')
  assert.deepEqual(loaded.position, beforeReload.position)
  assert.equal(loaded.health, beforeReload.health)
  assert.equal(loaded.level, beforeReload.level)
  assert.equal(loaded.xp, beforeReload.xp)
  assert.deepEqual(loaded.inventory, beforeReload.inventory)
  assert.deepEqual(loaded.questLog, beforeReload.questLog)
  assert.equal(loaded.objectives.sentinel, true)
  assert.equal(loaded.enemies.boss.health, 182)
  assert.equal(loaded.enemies.boss.phase, 2)
})

test('storage write failures do not throw out of a game action and are reported once until storage recovers', () => {
  let failWrites = true
  let reported = 0
  const storage = {
    getItem: () => null,
    setItem() {
      if (failWrites) throw new Error('storage unavailable')
    },
  }
  const store = createRpgProgressStore({ classId: 'warrior' }, storage, {
    loadSaved: false,
    onPersistenceError: () => { reported += 1 },
  })

  store.dispatch({ type: 'damage-player', amount: 20 })
  assert.doesNotThrow(() => store.dispatch({ type: 'use-item', itemId: 'health-potion' }, { persist: true }))
  assert.equal(store.getState().inventory.find(({ id }) => id === 'health-potion').quantity, 2)
  assert.equal(store.getState().health, 120)
  assert.equal(reported, 1)
  store.dispatch({ type: 'heal-player', amount: 1 }, { persist: true })
  assert.equal(reported, 1)
  failWrites = false
  store.dispatch({ type: 'heal-player', amount: 1 }, { persist: true })
  assert.equal(store.save(), true)
})

test('defeat prevents further mission progress and persists the defeated state', () => {
  const storage = createMemoryStorage()
  const store = createRpgProgressStore({ classId: 'guardian' }, storage)
  store.dispatch({ type: 'damage-player', amount: 1000 }, { persist: true })
  store.dispatch({ type: 'collect-relic' })
  assert.equal(store.getState().status, 'defeat')
  assert.equal(store.getState().health, 0)
  assert.equal(store.getState().objectives.relic, false)
  assert.equal(loadProgress(storage).status, 'defeat')
})

test('awards skill points on level and applies class-specific skill upgrades', () => {
  const store = createRpgProgressStore({ classId: 'warrior' }, createMemoryStorage(), { loadSaved: false })
  store.dispatch({ type: 'grant-xp', amount: 100 })
  assert.equal(store.getState().skillPoints, 1)
  store.dispatch({ type: 'purchase-skill', skillId: 'focus' })
  assert.equal(store.getState().skillPoints, 1)
  store.dispatch({ type: 'purchase-skill', skillId: 'mastery' })
  assert.equal(store.getState().skills.mastery, 1)
  assert.equal(store.getState().skillPoints, 0)
  store.dispatch({ type: 'purchase-skill', skillId: 'mastery' })
  assert.equal(store.getState().skills.mastery, 1)
})

test('resilience upgrades increase vitality and reduce incoming damage', () => {
  const store = createRpgProgressStore({ classId: 'guardian' }, createMemoryStorage(), { loadSaved: false })
  store.dispatch({ type: 'grant-xp', amount: 100 })
  store.dispatch({ type: 'purchase-skill', skillId: 'resilience' })
  const before = store.getState().health
  store.dispatch({ type: 'damage-player', amount: 25 })
  assert.equal(store.getState().maxHealth, 172)
  assert.equal(store.getState().health, before - 20)
})

test('migrates existing version-one saves without losing mission progress', () => {
  const storage = createMemoryStorage()
  storage.setItem('mythic-arena-3d-save-v1', JSON.stringify({
    version: 1,
    hero: { name: 'Old Hero', classId: 'warrior', gender: 'male', appearance: {} },
    position: { x: 2, y: 0, z: 8 },
    health: 80, maxHealth: 120, stamina: 90, maxStamina: 110,
    xp: 20, level: 2, gold: 35,
    inventory: [{ id: 'sunforged-blade', name: 'Wayfarer Blade', type: 'weapon' }],
    objectives: { briefing: true, relic: true, sentinel: true, gate: false },
    enemies: { sentinel: { health: 0, maxHealth: 100, defeated: true } },
    status: 'active',
  }))
  const migrated = createRpgProgressStore(undefined, storage).getState()
  assert.equal(migrated.version, 10)
  assert.equal(migrated.hero.name, 'Old Hero')
  assert.equal(migrated.objectives.sentinel, true)
  assert.equal(migrated.enemies.boss.health, 260)
  assert.equal(migrated.skillPoints, 1)
})

test('migrates version-two saves and does not recreate already-paid enemy drops', () => {
  const storage = createMemoryStorage()
  const oldSave = createInitialProgress({ classId: 'warrior' })
  oldSave.version = 2
  delete oldSave.enemyRewards
  for (const archetype of ENEMY_ARCHETYPES) delete oldSave.enemies[archetype.id]
  oldSave.enemies.sentinel.defeated = true
  oldSave.enemies.sentinel.health = 0
  storage.setItem('mythic-arena-3d-save-v1', JSON.stringify(oldSave))

  const migrated = createRpgProgressStore(undefined, storage).getState()
  assert.equal(migrated.version, 10)
  assert.equal(migrated.enemyRewards.sentinel.pending, false)
  assert.equal(migrated.enemyRewards.sentinel.collected, true)
  assert.equal(migrated.enemies.goblin.maxHealth, 72)
  assert.equal(migrated.enemies.darkArcher.maxHealth, 88)
  assert.equal(migrated.enemies.shadowBeast.maxHealth, 132)
  assert.equal(migrated.enemies.fireMonster.maxHealth, 148)
  assert.equal(migrated.enemies.eliteGuardian.maxHealth, 280)
})

test('migrates version-three saves with undamaged Goblin Warrior state', () => {
  const storage = createMemoryStorage()
  const oldSave = createInitialProgress({ classId: 'warrior' })
  oldSave.version = 3
  for (const archetype of ENEMY_ARCHETYPES) {
    delete oldSave.enemies[archetype.id]
    delete oldSave.enemyRewards[archetype.id]
  }
  storage.setItem('mythic-arena-3d-save-v1', JSON.stringify(oldSave))

  const migrated = createRpgProgressStore(undefined, storage).getState()
  assert.equal(migrated.version, 10)
  assert.equal(migrated.enemies.goblin.health, 72)
  assert.equal(migrated.enemyRewards.goblin.pending, false)
})
