import assert from 'node:assert/strict'
import test from 'node:test'
import { createInitialProgress, createRpgProgressStore } from './rpgProgression.js'
import { getSaleBlockReason, getSellPrice, MERCHANTS, MERCHANT_PRICES } from './merchants.js'
import { MAX_INVENTORY_SLOTS } from './inventoryItems.js'

function memoryStorage(initial) {
  const values = new Map(initial ? [['mythic-arena-3d-save-v1', JSON.stringify(initial)]] : [])
  return {
    getItem: (key) => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, value),
  }
}

function storeWithGold(gold = 1000, storage = memoryStorage()) {
  const store = createRpgProgressStore({ classId: 'warrior' }, storage, { loadSaved: false })
  store.dispatch({ type: 'restore', progress: { ...store.getState(), gold } })
  return store
}

test('purchases debit gold, add real items, and persist finite merchant stock', () => {
  const storage = memoryStorage()
  const store = storeWithGold(30, storage)
  const stock = store.getState().merchantStock.apothecary['field-ration']
  store.dispatch({ type: 'buy-item', merchantId: 'apothecary', itemId: 'field-ration' }, { persist: true })

  assert.equal(store.getState().gold, 12)
  assert.equal(store.getState().inventory.find(({ id }) => id === 'field-ration').quantity, 1)
  assert.equal(store.getState().merchantStock.apothecary['field-ration'], stock - 1)
  assert.equal(createRpgProgressStore(undefined, storage).getState().gold, 12)
  assert.equal(createRpgProgressStore(undefined, storage).getState().merchantStock.apothecary['field-ration'], stock - 1)
})

test('rejects purchases with insufficient gold, unavailable stock, invalid items, or duplicate unique gear', () => {
  const store = storeWithGold(0)
  const before = store.getState()
  store.dispatch({ type: 'buy-item', merchantId: 'apothecary', itemId: 'health-potion' })
  store.dispatch({ type: 'buy-item', merchantId: 'unknown', itemId: 'health-potion' })
  store.dispatch({ type: 'buy-item', merchantId: 'quartermaster', itemId: 'sun-relic' })
  store.dispatch({ type: 'buy-item', merchantId: 'quartermaster', itemId: 'warrior-axe' })
  assert.equal(store.getState(), before)

  store.dispatch({ type: 'restore', progress: { ...store.getState(), gold: 1000 } })
  store.dispatch({ type: 'buy-item', merchantId: 'quartermaster', itemId: 'warrior-axe' })
  assert.ok(store.getState().inventory.some(({ id }) => id === 'warrior-axe'))
  const gearState = store.getState()
  store.dispatch({ type: 'buy-item', merchantId: 'quartermaster', itemId: 'warrior-axe' })
  assert.equal(store.getState(), gearState)

  const outOfStock = store.getState().merchantStock.apothecary
  store.dispatch({
    type: 'restore',
    progress: {
      ...store.getState(),
      merchantStock: { ...store.getState().merchantStock, apothecary: { ...outOfStock, 'health-potion': 0 } },
    },
  })
  const soldOutState = store.getState()
  store.dispatch({ type: 'buy-item', merchantId: 'apothecary', itemId: 'health-potion' })
  assert.equal(store.getState(), soldOutState)
})

test('full inventory blocks a purchase without charging gold or reducing stock', () => {
  const store = storeWithGold(1000)
  const fullInventory = Array.from({ length: MAX_INVENTORY_SLOTS }, (_, index) => ({
    id: `test-item-${index}`,
    name: `Test Item ${index}`,
    type: 'material',
    quantity: 1,
  }))
  store.dispatch({ type: 'restore', progress: { ...store.getState(), inventory: fullInventory } })
  const before = store.getState()

  store.dispatch({ type: 'buy-item', merchantId: 'apothecary', itemId: 'field-ration' })
  assert.equal(store.getState(), before)
})

test('selling requires explicit confirmation at the UI boundary and rewards fair value once per unit', () => {
  const storage = memoryStorage()
  const store = storeWithGold(0, storage)
  store.dispatch({
    type: 'restore',
    progress: {
      ...store.getState(),
      inventory: [...store.getState().inventory, { id: 'field-ration', name: 'Wayfarer’s Field Ration', type: 'consumable', quantity: 2 }],
    },
  })
  const price = getSellPrice('field-ration')
  store.dispatch({ type: 'sell-item', merchantId: 'apothecary', itemId: 'field-ration' }, { persist: true })

  assert.equal(store.getState().gold, price)
  assert.equal(store.getState().inventory.find(({ id }) => id === 'field-ration').quantity, 1)
  assert.equal(store.getState().merchantStock.apothecary['field-ration'], MERCHANTS.apothecary.stock['field-ration'] + 1)
  assert.equal(createRpgProgressStore(undefined, storage).getState().gold, price)
})

test('quest items, equipped essentials, and goods outside a merchant category cannot be sold', () => {
  const store = storeWithGold(50)
  store.dispatch({
    type: 'restore',
    progress: {
      ...store.getState(),
      inventory: [
        ...store.getState().inventory,
        { id: 'sun-relic', name: 'Sun Relic', type: 'quest' },
        { id: 'warrior-axe', name: 'Warrior Axe', type: 'weapon' },
      ],
    },
  })
  assert.match(getSaleBlockReason(store.getState(), 'quartermaster', 'sunforged-blade'), /Unequip/)
  assert.match(getSaleBlockReason(store.getState(), 'quartermaster', 'sun-relic'), /Quest items/)
  assert.match(getSaleBlockReason(store.getState(), 'apothecary', 'warrior-axe'), /does not buy/)
  const before = store.getState()
  store.dispatch({ type: 'sell-item', merchantId: 'quartermaster', itemId: 'sunforged-blade' })
  assert.equal(store.getState(), before)
})

test('version-nine saves migrate to ten while preserving progression and initializing merchant stock', () => {
  const old = createInitialProgress({ name: 'Astra', classId: 'mage' })
  old.version = 9
  old.gold = 245
  old.inventory = [...old.inventory, { id: 'field-ration', name: 'Wayfarer’s Field Ration', type: 'consumable', quantity: 2 }]
  old.tutorial = { status: 'skipped', step: 4, confirmations: ['move'] }
  old.merchantStock = undefined
  const storage = memoryStorage(old)
  const migrated = createRpgProgressStore(undefined, storage).getState()

  assert.equal(migrated.version, 10)
  assert.equal(migrated.hero.name, 'Astra')
  assert.equal(migrated.gold, 245)
  assert.equal(migrated.inventory.find(({ id }) => id === 'field-ration').quantity, 2)
  assert.deepEqual(migrated.tutorial, old.tutorial)
  assert.equal(migrated.merchantStock.apothecary['field-ration'], MERCHANTS.apothecary.stock['field-ration'])
  assert.equal(createRpgProgressStore(undefined, storage).getState().version, 10)
})

test('merchant prices cover the listed catalog and resale value is lower than purchase value', () => {
  for (const merchant of Object.values(MERCHANTS)) {
    for (const itemId of Object.keys(merchant.stock)) {
      assert.ok(MERCHANT_PRICES[itemId] > 0)
      assert.ok(getSellPrice(itemId) < MERCHANT_PRICES[itemId])
    }
  }
})
