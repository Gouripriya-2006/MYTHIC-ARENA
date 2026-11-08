import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialProgress, createRpgProgressStore } from './rpgProgression.js'
import { getSkillBonuses, SKILL_TREES } from './skillTree.js'

function createMemoryStorage() {
  const values = new Map()
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

test('provides distinct gameplay skill trees for all three classes', () => {
  assert.deepEqual(Object.keys(SKILL_TREES), ['warrior', 'mage', 'guardian'])
  assert.ok(SKILL_TREES.warrior.some(({ bonuses }) => bonuses.heavyDamage))
  assert.ok(SKILL_TREES.mage.some(({ bonuses }) => bonuses.spellDamage))
  assert.ok(SKILL_TREES.guardian.some(({ bonuses }) => bonuses.counterDamage))
  assert.ok(Object.values(SKILL_TREES).every((tree) => tree.length >= 8))
})

test('requires the right class, level, prerequisites, and skill points to unlock skills', () => {
  const storage = createMemoryStorage()
  const warrior = createRpgProgressStore({ classId: 'warrior' }, storage, { loadSaved: false })
  const initial = warrior.getState()
  warrior.dispatch({ type: 'purchase-skill', skillId: 'warrior-vitality' })
  warrior.dispatch({ type: 'purchase-skill', skillId: 'mage-focus-1' })
  assert.equal(warrior.getState(), initial)

  warrior.dispatch({ type: 'grant-xp', amount: 100 })
  const beforePurchase = warrior.getState()
  const unlocked = warrior.dispatch({ type: 'purchase-skill', skillId: 'warrior-vitality' }, { persist: true })
  assert.notEqual(unlocked, initial)
  assert.deepEqual(unlocked.unlockedSkills, ['warrior-vitality'])
  assert.equal(unlocked.skillPoints, 0)
  assert.equal(unlocked.maxHealth, beforePurchase.maxHealth + 15)
  assert.equal(unlocked.health, beforePurchase.health + 15)
  assert.deepEqual(createRpgProgressStore(undefined, storage).getState().unlockedSkills, ['warrior-vitality'])

  const mage = createRpgProgressStore({ classId: 'mage' }, createMemoryStorage(), { loadSaved: false })
  mage.dispatch({ type: 'grant-xp', amount: 100 })
  const beforeStaminaUpgrade = mage.getState()
  const staminaUpgrade = mage.dispatch({ type: 'purchase-skill', skillId: 'mage-vitality' })
  assert.equal(staminaUpgrade.maxStamina, beforeStaminaUpgrade.maxStamina + 18)
  assert.equal(staminaUpgrade.stamina, beforeStaminaUpgrade.stamina + 18)
  mage.dispatch({ type: 'grant-xp', amount: 500 })
  const beforeHealthUpgrade = mage.getState()
  mage.dispatch({ type: 'purchase-skill', skillId: 'mage-life-ward' })
  assert.equal(mage.getState().maxHealth, beforeHealthUpgrade.maxHealth + 12)
})

test('prevents duplicate purchases and charges the full multi-point upgrade cost', () => {
  const store = createRpgProgressStore({ classId: 'warrior' }, createMemoryStorage(), { loadSaved: false })
  const readyState = {
    ...store.getState(),
    level: 6,
    skillPoints: 1,
    unlockedSkills: ['warrior-mastery-1', 'warrior-mastery-2', 'warrior-mastery-3'],
  }
  store.dispatch({ type: 'restore', progress: readyState })
  const before = store.getState()
  store.dispatch({ type: 'purchase-skill', skillId: 'warrior-warcry' })
  assert.equal(store.getState(), before)

  store.dispatch({ type: 'restore', progress: { ...before, skillPoints: 2 } })
  const purchased = store.dispatch({ type: 'purchase-skill', skillId: 'warrior-warcry' })
  assert.equal(purchased.skillPoints, 0)
  assert.ok(purchased.unlockedSkills.includes('warrior-warcry'))
  assert.equal(store.dispatch({ type: 'purchase-skill', skillId: 'warrior-warcry' }), purchased)
})

test('calculates passive combat bonuses and applies defense to incoming damage', () => {
  const store = createRpgProgressStore({ classId: 'warrior' }, createMemoryStorage(), { loadSaved: false })
  const state = {
    ...store.getState(),
    unlockedSkills: ['warrior-mastery-1', 'warrior-heavy-impact', 'warrior-iron-wall', 'warrior-precision', 'warrior-swift-step'],
  }
  const bonuses = getSkillBonuses(state)
  assert.equal(bonuses.meleeDamage, 0.14)
  assert.equal(bonuses.heavyDamage, 0.18)
  assert.equal(bonuses.defense, 0.06)
  assert.equal(bonuses.criticalChance, 0.05)
  assert.equal(bonuses.movementSpeed, 0.06)

  const defended = store.dispatch({ type: 'restore', progress: state })
  const damaged = store.dispatch({ type: 'damage-player', amount: 25 })
  assert.equal(defended.health - damaged.health, 22)
})

test('migrates version 6 skills and preserves existing character, inventory, equipment, and quests', () => {
  const storage = createMemoryStorage()
  const oldSave = createInitialProgress({
    name: 'Astra',
    classId: 'mage',
    gender: 'female',
    appearance: { outfitId: 'astral' },
  })
  oldSave.version = 6
  delete oldSave.unlockedSkills
  oldSave.level = 4
  oldSave.skillPoints = 2
  oldSave.skills = { mastery: 0, focus: 2, resilience: 0 }
  oldSave.inventory = [{ id: 'sun-relic', name: 'Sun Relic', type: 'quest' }]
  oldSave.equipment.mainHand = 'mage-staff'
  oldSave.objectives.relic = true
  oldSave.objectives.sentinel = true
  oldSave.enemies.sentinel.defeated = true
  oldSave.enemies.sentinel.health = 0
  oldSave.enemies.goblin.defeated = true
  oldSave.enemyRewards.goblin.collected = true
  oldSave.enemies.boss.health = 130
  oldSave.enemies.boss.phase = 2
  storage.setItem('mythic-arena-3d-save-v1', JSON.stringify(oldSave))

  const migrated = createRpgProgressStore(undefined, storage).getState()
  assert.equal(migrated.version, 10)
  assert.equal(migrated.hero.name, 'Astra')
  assert.equal(migrated.hero.appearance.outfitId, 'astral')
  assert.equal(migrated.skillPoints, 2)
  assert.deepEqual(migrated.unlockedSkills, ['mage-focus-1', 'mage-focus-2'])
  assert.ok(migrated.inventory.some(({ id }) => id === 'sun-relic'))
  assert.equal(migrated.equipment.mainHand, 'mage-staff')
  assert.equal(migrated.objectives.relic, true)
  assert.equal(migrated.objectives.sentinel, true)
  assert.equal(migrated.enemies.goblin.defeated, true)
  assert.equal(migrated.enemyRewards.goblin.collected, true)
  assert.equal(migrated.objectives.boss, false)
  assert.equal(migrated.enemies.boss.health, 130)
  assert.equal(migrated.enemies.boss.phase, 2)

  const persisted = JSON.parse(storage.getItem('mythic-arena-3d-save-v1'))
  assert.equal(persisted.version, 10)
  assert.deepEqual(persisted.unlockedSkills, ['mage-focus-1', 'mage-focus-2'])
})

test('safely normalizes missing and invalid skill data in saved progress', () => {
  const storage = createMemoryStorage()
  const brokenSave = createInitialProgress({ classId: 'guardian' })
  brokenSave.unlockedSkills = ['guardian-resilience-1', 'unknown-skill', 'warrior-mastery-1', 'guardian-resilience-1']
  brokenSave.skills = { resilience: 'invalid' }
  brokenSave.skillPoints = -10
  storage.setItem('mythic-arena-3d-save-v1', JSON.stringify(brokenSave))

  const loaded = createRpgProgressStore(undefined, storage).getState()
  assert.deepEqual(loaded.unlockedSkills, ['guardian-resilience-1'])
  assert.deepEqual(loaded.skills, { mastery: 0, focus: 0, resilience: 0 })
  assert.equal(loaded.skillPoints, 0)

  const missingTree = createInitialProgress({ classId: 'warrior' })
  missingTree.skills.mastery = 2
  delete missingTree.unlockedSkills
  storage.setItem('mythic-arena-3d-save-v1', JSON.stringify(missingTree))
  assert.deepEqual(createRpgProgressStore(undefined, storage).getState().unlockedSkills, ['warrior-mastery-1', 'warrior-mastery-2'])
})
