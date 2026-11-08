import { EQUIPMENT } from './equipment.js'

export const ITEM_RARITIES = ['Common', 'Rare', 'Epic', 'Legendary']
export const MAX_INVENTORY_SLOTS = 30
export const MAX_STACK_SIZE = 20

const GEAR_RARITY = {
  'sunforged-blade': 'Common',
  'warrior-great-sword': 'Epic',
  'warrior-axe': 'Rare',
  'mage-staff': 'Epic',
  'mage-wand': 'Rare',
  'guardian-shield': 'Epic',
  'guardian-heavy-sword': 'Rare',
  'light-armor': 'Common',
  'warrior-heavy-armor': 'Epic',
  'mage-robe': 'Epic',
  'guardian-armor': 'Epic',
  'kingdom-helmet': 'Rare',
  'kingdom-gloves': 'Rare',
  'kingdom-boots': 'Common',
}

const gearItems = EQUIPMENT.map((item) => ({
  ...item,
  rarity: GEAR_RARITY[item.id] ?? 'Common',
  description: `${item.name} made for ${item.classes.join(', ')} adventurers.`,
  stackable: false,
  category: item.type,
  statText: [item.damage ? `+${item.damage} attack` : '', item.defense ? `+${item.defense} defense` : '', item.speed ? `${item.speed > 0 ? '+' : ''}${Math.round(item.speed * 100)}% movement` : '']
    .filter(Boolean).join(' · ') || 'No direct stat bonus',
}))

export const INVENTORY_ITEMS = Object.freeze(Object.fromEntries([
  ...gearItems.map((item) => [item.id, item]),
  ['health-potion', {
    id: 'health-potion', name: 'Health Potion', type: 'consumable', category: 'consumables', rarity: 'Common',
    description: 'A small flask of red restorative tonic.', effect: { health: 60 }, stackable: true, maxStack: MAX_STACK_SIZE, statText: 'Restores 60 health',
  }],
  ['mana-potion', {
    id: 'mana-potion', name: 'Mana Potion', type: 'consumable', category: 'consumables', rarity: 'Common',
    description: 'A cool blue draught that restores spell energy.', effect: { stamina: 55 }, stackable: true, maxStack: MAX_STACK_SIZE, statText: 'Restores 55 spell energy',
  }],
  ['field-ration', {
    id: 'field-ration', name: 'Wayfarer’s Field Ration', type: 'consumable', category: 'consumables', rarity: 'Uncommon',
    description: 'A compact travel meal that restores a little health and stamina.', effect: { health: 28, stamina: 28 }, stackable: true, maxStack: MAX_STACK_SIZE, statText: 'Restores 28 health and stamina',
  }],
  ['sun-relic', {
    id: 'sun-relic', name: 'Sun Relic', type: 'quest', category: 'quest', rarity: 'Legendary',
    description: 'The ancient light at the heart of the Lost Kingdom.', stackable: false, statText: 'Quest item',
  }],
  ['ancient-cache', {
    id: 'ancient-cache', name: 'Sanctum Cache', type: 'treasure', category: 'quest', rarity: 'Epic',
    description: 'A recovered cache from the sanctum ruins.', stackable: false, statText: 'Contains 50 gold',
  }],
  ['level-rune', {
    id: 'level-rune', name: 'Level Rune', type: 'material', category: 'materials', rarity: 'Common',
    description: 'A rune left by a completed level milestone.', stackable: true, maxStack: MAX_STACK_SIZE, statText: 'Progression material',
  }],
]))

export function getItemDefinition(itemOrId) {
  const id = typeof itemOrId === 'string' ? itemOrId : itemOrId?.id
  if (INVENTORY_ITEMS[id]) return INVENTORY_ITEMS[id]
  if (typeof itemOrId === 'object' && itemOrId) {
    return {
      id,
      name: itemOrId.name ?? id,
      type: itemOrId.type ?? 'material',
      category: itemOrId.type === 'quest' || itemOrId.type === 'treasure' ? 'quest' : 'materials',
      rarity: itemOrId.rarity ?? 'Common',
      description: itemOrId.description ?? 'A keepsake from the kingdom.',
      stackable: itemOrId.type === 'material',
      maxStack: MAX_STACK_SIZE,
      statText: itemOrId.type === 'quest' ? 'Quest item' : 'Material',
    }
  }
  return null
}

export function getEnemyLoot(enemyId) {
  if (enemyId === 'darkArcher' || enemyId === 'fireMonster' || enemyId === 'boss') return { itemId: 'mana-potion', quantity: 1 }
  return { itemId: 'health-potion', quantity: 1 }
}
