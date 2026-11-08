import { EQUIPMENT_BY_ID } from './equipment.js'
import { addInventoryItem, removeInventoryItem } from './inventory.js'
import { getItemDefinition } from './inventoryItems.js'

export const MERCHANTS = Object.freeze({
  quartermaster: {
    id: 'quartermaster',
    name: 'Bram Ironhand',
    role: 'Quartermaster',
    accepts: ['weapon', 'armor', 'consumable', 'material'],
    stock: {
      'warrior-great-sword': 2,
      'warrior-axe': 3,
      'mage-staff': 2,
      'mage-wand': 3,
      'guardian-shield': 2,
      'guardian-heavy-sword': 2,
      'light-armor': 3,
      'warrior-heavy-armor': 2,
      'mage-robe': 2,
      'guardian-armor': 2,
      'kingdom-helmet': 4,
      'kingdom-gloves': 4,
      'kingdom-boots': 4,
    },
  },
  apothecary: {
    id: 'apothecary',
    name: 'Lyra Thornbloom',
    role: 'Apothecary',
    accepts: ['consumable', 'material'],
    stock: {
      'health-potion': 12,
      'mana-potion': 12,
      'field-ration': 8,
    },
  },
})

export const MERCHANT_PRICES = Object.freeze({
  'warrior-great-sword': 190,
  'warrior-axe': 140,
  'mage-staff': 180,
  'mage-wand': 110,
  'guardian-shield': 165,
  'guardian-heavy-sword': 150,
  'light-armor': 75,
  'warrior-heavy-armor': 220,
  'mage-robe': 190,
  'guardian-armor': 205,
  'kingdom-helmet': 65,
  'kingdom-gloves': 45,
  'kingdom-boots': 55,
  'health-potion': 12,
  'mana-potion': 12,
  'field-ration': 18,
  'level-rune': 80,
})

const SELL_PERCENT = 0.45
const MAX_MERCHANT_STOCK = 99

export function createMerchantStock() {
  return Object.fromEntries(Object.entries(MERCHANTS).map(([id, merchant]) => [
    id,
    { ...merchant.stock },
  ]))
}

export function normalizeMerchantStock(value) {
  const defaults = createMerchantStock()
  for (const [merchantId, stock] of Object.entries(defaults)) {
    const saved = value?.[merchantId]
    for (const itemId of Object.keys(stock)) {
      const count = saved?.[itemId]
      stock[itemId] = Number.isInteger(count) && count >= 0
        ? Math.min(MAX_MERCHANT_STOCK, count)
        : MERCHANTS[merchantId].stock[itemId]
    }
  }
  return defaults
}

export function getMerchantOffers(merchantId) {
  const merchant = MERCHANTS[merchantId]
  if (!merchant) return []
  return Object.keys(merchant.stock).map((itemId) => ({
    itemId,
    price: MERCHANT_PRICES[itemId],
    definition: getItemDefinition(itemId),
  })).filter((offer) => offer.definition && Number.isInteger(offer.price) && offer.price > 0)
}

export function getPurchaseBlockReason(state, merchantId, itemId) {
  const merchant = MERCHANTS[merchantId]
  if (!merchant || !Object.hasOwn(merchant.stock, itemId)) return 'This merchant does not sell that item.'
  if (!Number.isInteger(state.merchantStock?.[merchantId]?.[itemId])) return 'Merchant stock is unavailable.'
  if (state.merchantStock[merchantId][itemId] <= 0) return 'Sold out.'
  const definition = getItemDefinition(itemId)
  if (!definition || !MERCHANT_PRICES[itemId]) return 'This item cannot be purchased.'
  const equipment = EQUIPMENT_BY_ID[itemId]
  if (equipment && !equipment.classes.includes(state.hero.classId)) return `Only ${equipment.classes.join(', ')} heroes can use this gear.`
  if (Number.isFinite(state.gold) && state.gold < MERCHANT_PRICES[itemId]) return 'Not enough gold.'
  const added = addInventoryItem(state.inventory, itemId)
  if (added.remaining) {
    return !definition.stackable && state.inventory.some((item) => item.id === itemId)
      ? 'You already own this unique item.'
      : 'Your inventory is full.'
  }
  return ''
}

export function buyMerchantItem(state, merchantId, itemId) {
  if (getPurchaseBlockReason(state, merchantId, itemId)) return state
  const price = MERCHANT_PRICES[itemId]
  const added = addInventoryItem(state.inventory, itemId)
  if (added.remaining) return state
  const next = {
    ...state,
    gold: state.gold - price,
    inventory: added.inventory,
    merchantStock: {
      ...state.merchantStock,
      [merchantId]: {
        ...state.merchantStock[merchantId],
        [itemId]: state.merchantStock[merchantId][itemId] - 1,
      },
    },
  }
  return next
}

export function getSellPrice(itemId) {
  const price = MERCHANT_PRICES[itemId]
  return Number.isInteger(price) && price > 0 ? Math.max(1, Math.floor(price * SELL_PERCENT)) : 0
}

export function getSaleBlockReason(state, merchantId, itemId) {
  const merchant = MERCHANTS[merchantId]
  if (!merchant) return 'This merchant cannot buy items.'
  const item = state.inventory.find((entry) => entry.id === itemId && (entry.quantity ?? 1) > 0)
  if (!item) return 'You no longer have this item.'
  const definition = getItemDefinition(item)
  if (!definition || definition.category === 'quest') return 'Quest items cannot be sold.'
  if (Object.values(state.equipment).includes(itemId)) return 'Unequip this essential item before selling it.'
  if (!merchant.accepts.includes(definition.type)) return `${merchant.name} does not buy this kind of item.`
  if (!getSellPrice(itemId)) return 'This item has no resale value.'
  return ''
}

export function sellMerchantItem(state, merchantId, itemId) {
  if (getSaleBlockReason(state, merchantId, itemId)) return state
  const price = getSellPrice(itemId)
  const inventory = removeInventoryItem(state.inventory, itemId, 1)
  if (inventory === state.inventory) return state
  const initialStock = MERCHANTS[merchantId].stock[itemId] ?? 0
  const stock = state.merchantStock[merchantId][itemId]
  const merchantStock = stock === undefined
    ? state.merchantStock
    : {
      ...state.merchantStock,
      [merchantId]: {
        ...state.merchantStock[merchantId],
        [itemId]: Math.min(MAX_MERCHANT_STOCK, Math.max(initialStock, stock) + 1),
      },
    }
    return { ...state, gold: state.gold + price, inventory, merchantStock }
}
