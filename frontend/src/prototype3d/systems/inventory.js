import { EQUIPMENT_BY_ID } from './equipment.js'
import { getItemDefinition, MAX_INVENTORY_SLOTS, MAX_STACK_SIZE } from './inventoryItems.js'

export function normalizeInventory(inventory = []) {
  return inventory.map((entry) => {
    const definition = getItemDefinition(entry)
    return {
      ...entry,
      quantity: Number.isInteger(entry.quantity) && entry.quantity > 0 ? entry.quantity : 1,
      rarity: definition?.rarity ?? 'Common',
      description: entry.description ?? definition?.description ?? 'An item from the kingdom.',
    }
  })
}

export function addInventoryItem(inventory, itemId, quantity = 1, capacity = MAX_INVENTORY_SLOTS) {
  const definition = getItemDefinition(itemId)
  if (!definition || !Number.isInteger(quantity) || quantity <= 0) return { inventory, added: 0, remaining: quantity }
  const items = normalizeInventory(inventory)
  let remaining = quantity
  const maxStack = definition.stackable ? definition.maxStack ?? MAX_STACK_SIZE : 1
  if (!definition.stackable && items.some((entry) => entry.id === itemId)) {
    return { inventory, added: 0, remaining }
  }

  while (remaining > 0) {
    const stack = definition.stackable ? items.find((entry) => entry.id === itemId && entry.quantity < maxStack) : null
    if (stack) {
      const amount = Math.min(remaining, maxStack - stack.quantity)
      stack.quantity += amount
      remaining -= amount
      continue
    }
    if (items.length >= capacity) break
    const amount = Math.min(remaining, maxStack)
    items.push({
      id: itemId,
      name: definition.name,
      type: definition.type,
      quantity: amount,
      rarity: definition.rarity,
      description: definition.description,
    })
    remaining -= amount
  }
  return { inventory: remaining === quantity ? inventory : items, added: quantity - remaining, remaining }
}

export function removeInventoryItem(inventory, itemId, quantity = 1) {
  if (!Number.isInteger(quantity) || quantity <= 0) return inventory
  const index = inventory.findIndex((entry) => entry.id === itemId && (entry.quantity ?? 1) >= quantity)
  if (index < 0) return inventory
  const next = [...inventory]
  const current = next[index]
  if ((current.quantity ?? 1) === quantity) next.splice(index, 1)
  else next[index] = { ...current, quantity: current.quantity - quantity }
  return next
}

export function sortInventory(inventory, sortBy = 'rarity') {
  const rarityOrder = { Legendary: 4, Epic: 3, Rare: 2, Uncommon: 1, Common: 0 }
  const items = [...inventory]
  if (sortBy === 'name') return items.sort((a, b) => a.name.localeCompare(b.name))
  if (sortBy === 'type') return items.sort((a, b) => (getItemDefinition(a)?.category ?? '').localeCompare(getItemDefinition(b)?.category ?? '') || a.name.localeCompare(b.name))
  return items.sort((a, b) => (rarityOrder[getItemDefinition(b)?.rarity] ?? -1) - (rarityOrder[getItemDefinition(a)?.rarity] ?? -1) || a.name.localeCompare(b.name))
}

export function filterInventory(inventory, category = 'all') {
  if (category === 'all') return [...inventory]
  return inventory.filter((item) => getItemDefinition(item)?.category === category)
}

export function useConsumable(state, itemId) {
  const definition = getItemDefinition(itemId)
  const entry = state.inventory.find((item) => item.id === itemId && (item.quantity ?? 1) > 0)
  if (!definition?.effect || !entry) return state
  const health = definition.effect.health
    ? Math.min(state.maxHealth, state.health + definition.effect.health)
    : state.health
  const stamina = definition.effect.stamina
    ? Math.min(state.maxStamina, state.stamina + definition.effect.stamina)
    : state.stamina
  if (health === state.health && stamina === state.stamina) return state
  return { ...state, health, stamina, inventory: removeInventoryItem(state.inventory, itemId) }
}

export function canUseItem(state, itemId) {
  const definition = getItemDefinition(itemId)
  const entry = state.inventory.find((item) => item.id === itemId && (item.quantity ?? 1) > 0)
  if (!definition?.effect || !entry) return false
  return Boolean((definition.effect.health && state.health < state.maxHealth)
    || (definition.effect.stamina && state.stamina < state.maxStamina)
  )
}

export function canDiscardItem(itemId, inventory = []) {
  const definition = getItemDefinition(inventory.find((entry) => entry.id === itemId) ?? itemId)
  return Boolean(definition && !EQUIPMENT_BY_ID[itemId] && definition.category !== 'quest')
}

