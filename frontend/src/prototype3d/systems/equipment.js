export const EQUIPMENT = [
  { id: 'sunforged-blade', name: 'Wayfarer Blade', type: 'weapon', slot: 'mainHand', classes: ['warrior', 'mage', 'guardian'], kind: 'sword', damage: 0, defense: 0, speed: 0, color: '#d7dce0', accent: '#c39243' },
  { id: 'warrior-great-sword', name: 'Great Sword', type: 'weapon', slot: 'mainHand', classes: ['warrior'], kind: 'greatSword', damage: 12, defense: 0, speed: -0.06, color: '#c5d0d4', accent: '#a77c35' },
  { id: 'warrior-axe', name: 'Warrior Axe', type: 'weapon', slot: 'mainHand', classes: ['warrior'], kind: 'axe', damage: 9, defense: 0, speed: -0.025, color: '#b9c5c8', accent: '#8a5330' },
  { id: 'mage-staff', name: 'Magic Staff', type: 'weapon', slot: 'mainHand', classes: ['mage'], kind: 'staff', damage: 8, defense: 0, speed: 0, color: '#8568c8', accent: '#8fe3df' },
  { id: 'mage-wand', name: 'Wand', type: 'weapon', slot: 'mainHand', classes: ['mage'], kind: 'wand', damage: 4, defense: 0, speed: 0.02, color: '#664a35', accent: '#96e5df' },
  { id: 'guardian-shield', name: 'Guardian Shield', type: 'weapon', slot: 'offHand', classes: ['guardian'], kind: 'shield', damage: 2, defense: 5, speed: -0.025, color: '#6a8e75', accent: '#d9bd70' },
  { id: 'guardian-heavy-sword', name: 'Heavy Sword', type: 'weapon', slot: 'mainHand', classes: ['guardian'], kind: 'greatSword', damage: 8, defense: 0, speed: -0.05, color: '#91a6b2', accent: '#d3b768' },
  { id: 'light-armor', name: 'Light Armor', type: 'armor', slot: 'armor', classes: ['warrior', 'mage', 'guardian'], kind: 'lightArmor', damage: 0, defense: 8, speed: 0.025, color: '#658a65', accent: '#c5a766' },
  { id: 'warrior-heavy-armor', name: 'Warrior Heavy Armor', type: 'armor', slot: 'armor', classes: ['warrior'], kind: 'heavyArmor', damage: 0, defense: 20, speed: -0.09, color: '#82919b', accent: '#cf9d42' },
  { id: 'mage-robe', name: 'Mage Robe', type: 'armor', slot: 'armor', classes: ['mage'], kind: 'robe', damage: 0, defense: 10, speed: 0.015, color: '#65548f', accent: '#b77ade' },
  { id: 'guardian-armor', name: 'Guardian Armor', type: 'armor', slot: 'armor', classes: ['guardian'], kind: 'guardianArmor', damage: 0, defense: 17, speed: -0.055, color: '#587f67', accent: '#d9bd70' },
  { id: 'kingdom-helmet', name: 'Ruined Helm', type: 'armor', slot: 'helmet', classes: ['warrior', 'mage', 'guardian'], kind: 'helmet', damage: 0, defense: 5, speed: 0, color: '#8c9a9c', accent: '#d4b865' },
  { id: 'kingdom-gloves', name: 'Iron Gloves', type: 'armor', slot: 'gloves', classes: ['warrior', 'mage', 'guardian'], kind: 'gloves', damage: 0, defense: 3, speed: 0, color: '#817567', accent: '#c6b17e' },
  { id: 'kingdom-boots', name: 'Trail Boots', type: 'armor', slot: 'boots', classes: ['warrior', 'mage', 'guardian'], kind: 'boots', damage: 0, defense: 3, speed: 0.035, color: '#664a35', accent: '#9b7950' },
]

export const EQUIPMENT_BY_ID = Object.fromEntries(EQUIPMENT.map((item) => [item.id, item]))
export const EQUIPMENT_SLOTS = ['mainHand', 'offHand', 'armor', 'helmet', 'gloves', 'boots']
export const EMPTY_EQUIPMENT = Object.freeze(Object.fromEntries(EQUIPMENT_SLOTS.map((slot) => [slot, null])))

export function createStarterInventory(classId) {
  if (['warrior', 'mage', 'guardian'].includes(classId)) {
    const loadout = createDefaultEquipment(classId)
    return [
      ...EQUIPMENT.filter(({ id }) => Object.values(loadout).includes(id))
        .map(({ id, name, type }) => ({ id, name, type })),
      { id: 'health-potion', name: 'Health Potion', type: 'consumable', quantity: 3 },
      { id: 'mana-potion', name: 'Mana Potion', type: 'consumable', quantity: 3 },
    ]
  }
  return [
    { id: 'sunforged-blade', name: 'Wayfarer Blade', type: 'weapon' },
    ...EQUIPMENT.filter(({ id }) => id !== 'sunforged-blade').map(({ id, name, type }) => ({ id, name, type })),
    { id: 'health-potion', name: 'Health Potion', type: 'consumable', quantity: 3 },
    { id: 'mana-potion', name: 'Mana Potion', type: 'consumable', quantity: 3 },
  ]
}

export function getEquipmentStats(loadout = EMPTY_EQUIPMENT) {
  const items = EQUIPMENT_SLOTS.map((slot) => EQUIPMENT_BY_ID[loadout?.[slot]]).filter(Boolean)
  const rawSpeed = items.reduce((sum, item) => sum + item.speed, 0)
  return {
    damage: items.reduce((sum, item) => sum + item.damage, 0),
    defense: items.reduce((sum, item) => sum + item.defense, 0),
    movementMultiplier: Math.max(0.75, Math.min(1.15, 1 + rawSpeed)),
    damageReduction: Math.min(0.4, items.reduce((sum, item) => sum + item.defense, 0) / 100),
  }
}

export function createDefaultEquipment(classId) {
  return {
    ...EMPTY_EQUIPMENT,
    mainHand: classId === 'mage' ? 'mage-staff' : classId === 'guardian' ? 'guardian-heavy-sword' : 'sunforged-blade',
    offHand: classId === 'guardian' ? 'guardian-shield' : null,
    armor: 'light-armor',
  }
}

export function canEquipItem(itemId, classId, inventory = []) {
  const item = EQUIPMENT_BY_ID[itemId]
  return Boolean(item && inventory.some(({ id }) => id === itemId) && item.classes.includes(classId))
}
