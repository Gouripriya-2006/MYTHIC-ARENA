import assert from 'node:assert/strict'
import test from 'node:test'
import {
  addInventoryItem,
  canUseItem,
  filterInventory,
  removeInventoryItem,
  sortInventory,
} from './inventory.js'
import { MAX_INVENTORY_SLOTS } from './inventoryItems.js'
import { createInitialProgress, createRpgProgressStore } from './rpgProgression.js'

function memoryStorage(value) {
  let json = value ? JSON.stringify(value) : null
  return { getItem: () => json, setItem: (_key, value) => { json = value }, get value() { return JSON.parse(json) } }
}

test('stackable potions respect stack size, slot capacity, and item removal', () => {
  const first = addInventoryItem([], 'health-potion', 22, 1)
  assert.equal(first.added, 20)
  assert.equal(first.remaining, 2)
  assert.equal(first.inventory[0].quantity, 20)
  const second = addInventoryItem(first.inventory, 'health-potion', 2, 2)
  assert.equal(second.inventory.length, 2)
  assert.equal(second.inventory[1].quantity, 2)
  const filled = addInventoryItem(second.inventory, 'health-potion', 18, 2)
  assert.equal(filled.inventory[1].quantity, 20)
  assert.equal(addInventoryItem(filled.inventory, 'health-potion', 1, 2).remaining, 1)
  assert.equal(removeInventoryItem(second.inventory, 'health-potion', 3)[0].quantity, 17)
})

test('inventory supports rarity sorting and category filters', () => {
  const inventory = createInitialProgress({ classId: 'warrior' }).inventory
  inventory.push({ id: 'sun-relic', name: 'Sun Relic', type: 'quest' })
  const raritySorted = sortInventory(inventory, 'rarity')
  assert.equal(raritySorted[0].id, 'sun-relic')
  assert.ok(filterInventory(inventory, 'weapon').every(({ type }) => type === 'weapon'))
  assert.ok(filterInventory(inventory, 'consumables').every(({ type }) => type === 'consumable'))
  assert.ok(filterInventory(inventory, 'all').length === inventory.length)
  assert.equal(sortInventory(inventory, 'name')[0].name, [...inventory].sort((a, b) => a.name.localeCompare(b.name))[0].name)
})

test('health and mana potions restore the real player health and spell stamina and consume one charge', () => {
  const store = createRpgProgressStore({ classId: 'mage' }, memoryStorage(), { loadSaved: false })
  const before = store.getState()
  store.dispatch({ type: 'damage-player', amount: 45 })
  store.dispatch({ type: 'spend-stamina', amount: 45 })
  assert.equal(canUseItem(store.getState(), 'health-potion'), true)
  assert.equal(canUseItem(store.getState(), 'mana-potion'), true)
  const healthPotionCount = store.getState().inventory.find(({ id }) => id === 'health-potion').quantity
  const manaPotionCount = store.getState().inventory.find(({ id }) => id === 'mana-potion').quantity
  const healthBefore = store.getState().health
  store.dispatch({ type: 'use-item', itemId: 'health-potion' })
  assert.ok(store.getState().health > healthBefore)
  assert.equal(store.getState().inventory.find(({ id }) => id === 'health-potion').quantity, healthPotionCount - 1)
  store.dispatch({ type: 'damage-player', amount: 30 })
  store.dispatch({ type: 'use-item', itemId: 'health-potion' })
  assert.equal(store.getState().inventory.find(({ id }) => id === 'health-potion').quantity, healthPotionCount - 2)
  const staminaBefore = store.getState().stamina
  store.dispatch({ type: 'use-item', itemId: 'mana-potion' })
  assert.equal(store.getState().stamina, Math.min(before.maxStamina, staminaBefore + 55))
  assert.equal(store.getState().inventory.find(({ id }) => id === 'mana-potion').quantity, manaPotionCount - 1)
})

test('full health or stamina prevents potion use and does not consume items', () => {
  const store = createRpgProgressStore({ classId: 'warrior' }, memoryStorage(), { loadSaved: false })
  const state = store.getState()
  store.dispatch({ type: 'use-item', itemId: 'health-potion' })
  store.dispatch({ type: 'use-item', itemId: 'mana-potion' })
  assert.equal(store.getState(), state)
  assert.equal(canUseItem(state, 'health-potion'), false)
})

test('purchased field rations restore both health and stamina through the existing consumable flow', () => {
  const store = createRpgProgressStore({ classId: 'warrior' }, memoryStorage(), { loadSaved: false })
  store.dispatch({ type: 'collect-cache' })
  store.dispatch({ type: 'buy-item', merchantId: 'apothecary', itemId: 'field-ration' })
  assert.ok(store.getState().inventory.some(({ id }) => id === 'field-ration'))
  store.dispatch({ type: 'damage-player', amount: 40 })
  store.dispatch({ type: 'spend-stamina', amount: 35 })
  const before = store.getState()
  store.dispatch({ type: 'use-item', itemId: 'field-ration' })

  assert.equal(store.getState().health, Math.min(before.maxHealth, before.health + 28))
  assert.equal(store.getState().stamina, before.stamina + 28)
  assert.equal(store.getState().inventory.some(({ id }) => id === 'field-ration'), false)
})

test('enemy defeat grants persistent potion loot with its existing one-time gold pickup', () => {
  const storage = memoryStorage()
  const store = createRpgProgressStore({ classId: 'mage' }, storage, { loadSaved: false })
  store.dispatch({ type: 'damage-enemy', enemyId: 'goblin', amount: 72 }, { persist: true })
  assert.deepEqual(store.getState().enemyRewards.goblin.loot, { itemId: 'health-potion', quantity: 1 })
  const gold = store.getState().gold
  const potionCount = store.getState().inventory.find(({ id }) => id === 'health-potion').quantity
  store.dispatch({ type: 'collect-enemy-reward', enemyId: 'goblin' }, { persist: true })
  assert.equal(store.getState().gold, gold + 15)
  assert.equal(store.getState().inventory.find(({ id }) => id === 'health-potion').quantity, potionCount + 1)
  assert.equal(store.getState().enemyRewards.goblin.loot, null)
  store.dispatch({ type: 'collect-enemy-reward', enemyId: 'goblin' })
  assert.equal(store.getState().gold, gold + 15)
  assert.equal(createRpgProgressStore(undefined, storage).getState().inventory.find(({ id }) => id === 'health-potion').quantity, potionCount + 1)
})

test('inventory capacity blocks loot without consuming the reward, then allows it after discarding a material', () => {
  const store = createRpgProgressStore({ classId: 'warrior' }, memoryStorage(), { loadSaved: false })
  const fullInventory = Array.from({ length: MAX_INVENTORY_SLOTS }, (_, index) => ({
    id: `test-material-${index}`, name: `Material ${index}`, type: 'material', quantity: 1,
  }))
  store.dispatch({ type: 'restore', progress: { ...store.getState(), inventory: fullInventory } })
  store.dispatch({ type: 'damage-enemy', enemyId: 'goblin', amount: 72 })
  const beforePickup = store.getState()
  store.dispatch({ type: 'collect-enemy-reward', enemyId: 'goblin' })
  assert.equal(store.getState(), beforePickup)
  assert.equal(store.getState().enemyRewards.goblin.pending, true)
  store.dispatch({ type: 'discard-item', itemId: 'test-material-0' })
  store.dispatch({ type: 'collect-enemy-reward', enemyId: 'goblin' })
  assert.equal(store.getState().enemyRewards.goblin.pending, false)
  assert.ok(store.getState().inventory.some(({ id }) => id === 'health-potion'))
})

test('version-five saves migrate to version ten without losing items and add potion stacks once', () => {
  const old = createInitialProgress({ classId: 'guardian' })
  old.version = 5
  old.inventory = old.inventory.filter(({ id }) => id !== 'health-potion' && id !== 'mana-potion')
  for (const reward of Object.values(old.enemyRewards)) delete reward.loot
  const storage = memoryStorage(old)
  const loaded = createRpgProgressStore(undefined, storage).getState()
  assert.equal(loaded.version, 10)
  assert.ok(loaded.inventory.some(({ id }) => id === 'guardian-shield'))
  assert.equal(loaded.inventory.find(({ id }) => id === 'health-potion').quantity, 3)
  assert.equal(loaded.inventory.find(({ id }) => id === 'mana-potion').quantity, 3)
  assert.equal(createRpgProgressStore(undefined, storage).getState().inventory.find(({ id }) => id === 'health-potion').quantity, 3)
})
