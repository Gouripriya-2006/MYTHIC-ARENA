import assert from 'node:assert/strict'
import test from 'node:test'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js'
import { Scene } from '@babylonjs/core/scene.js'
import { createHeroCharacter } from '../heroCharacter.js'
import {
  canEquipItem,
  createDefaultEquipment,
  createStarterInventory,
  EQUIPMENT,
  getEquipmentStats,
} from './equipment.js'
import { createInitialProgress, createRpgProgressStore } from './rpgProgression.js'

function makeStorage(value) {
  let serialized = value ? JSON.stringify(value) : null
  return {
    getItem: () => serialized,
    setItem: (_key, next) => { serialized = next },
    get value() { return JSON.parse(serialized) },
  }
}

test('all listed weapon and armor variants have class and slot definitions', () => {
  const ids = new Set(EQUIPMENT.map(({ id }) => id))
  for (const id of [
    'sunforged-blade', 'warrior-great-sword', 'warrior-axe', 'mage-staff', 'mage-wand',
    'guardian-shield', 'guardian-heavy-sword', 'light-armor', 'warrior-heavy-armor',
    'mage-robe', 'guardian-armor', 'kingdom-helmet', 'kingdom-gloves', 'kingdom-boots',
  ]) assert.ok(ids.has(id), `Missing ${id}`)
  assert.equal(canEquipItem('warrior-axe', 'warrior', createStarterInventory()), true)
  assert.equal(canEquipItem('warrior-axe', 'mage', createStarterInventory()), false)
  assert.equal(canEquipItem('mage-wand', 'mage', createStarterInventory()), true)
})

test('equipment reducer equips and unequips valid slots while rejecting class-restricted items', () => {
  const store = createRpgProgressStore({ classId: 'mage' }, makeStorage(), { loadSaved: false })
  store.dispatch({
    type: 'restore',
    progress: {
      ...store.getState(),
      inventory: [...store.getState().inventory, { id: 'mage-wand', name: 'Wand', type: 'weapon' }],
    },
  })
  const before = store.getState()
  store.dispatch({ type: 'equip-item', itemId: 'mage-wand' })
  assert.equal(store.getState().equipment.mainHand, 'mage-wand')
  store.dispatch({ type: 'equip-item', itemId: 'warrior-axe' })
  assert.equal(store.getState().equipment.mainHand, 'mage-wand')
  store.dispatch({ type: 'unequip-item', slot: 'mainHand' })
  assert.equal(store.getState().equipment.mainHand, null)
  store.dispatch({ type: 'unequip-item', slot: 'not-a-slot' })
  assert.notEqual(store.getState(), before)
})

test('each class receives a legal default loadout and stats use equipped item values', () => {
  const warrior = createDefaultEquipment('warrior')
  const mage = createDefaultEquipment('mage')
  const guardian = createDefaultEquipment('guardian')
  assert.equal(warrior.mainHand, 'sunforged-blade')
  assert.equal(mage.mainHand, 'mage-staff')
  assert.equal(guardian.mainHand, 'guardian-heavy-sword')
  assert.equal(guardian.offHand, 'guardian-shield')
  assert.ok(getEquipmentStats(guardian).damage > 0)
  assert.ok(getEquipmentStats(guardian).defense > 0)
  assert.notEqual(getEquipmentStats({ armor: 'warrior-heavy-armor' }).movementMultiplier, 1)
})

test('new characters begin with their own equipped gear and potions, leaving other equipment for progression', () => {
  const warrior = createInitialProgress({ classId: 'warrior' })
  const mage = createInitialProgress({ classId: 'mage' })
  const guardian = createInitialProgress({ classId: 'guardian' })

  assert.deepEqual(warrior.inventory.map(({ id }) => id), ['sunforged-blade', 'light-armor', 'health-potion', 'mana-potion'])
  assert.ok(mage.inventory.some(({ id }) => id === 'mage-staff'))
  assert.ok(!mage.inventory.some(({ id }) => id === 'warrior-axe'))
  assert.ok(guardian.inventory.some(({ id }) => id === 'guardian-shield'))
  assert.ok(!guardian.inventory.some(({ id }) => id === 'warrior-heavy-armor'))
})

test('enemy damage reduction includes equipped armor and remains bounded to one damage', () => {
  const storage = makeStorage()
  const store = createRpgProgressStore({ classId: 'guardian' }, storage, { loadSaved: false })
  store.dispatch({
    type: 'restore',
    progress: {
      ...store.getState(),
      inventory: [...store.getState().inventory, { id: 'kingdom-helmet', name: 'Ruined Helm', type: 'armor' }],
    },
  })
  const initial = store.getState().health
  store.dispatch({ type: 'damage-player', amount: 50 })
  const withoutHelmet = initial - store.getState().health
  assert.equal(withoutHelmet, 44)
  store.dispatch({ type: 'equip-item', itemId: 'kingdom-helmet' })
  const withHelmet = store.getState().health
  store.dispatch({ type: 'damage-player', amount: 50 })
  assert.ok(withHelmet - store.getState().health < withoutHelmet)
})

test('equipment visuals mount hand, body, head, glove and boot items on the intended primitive joints', () => {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  const hero = createHeroCharacter(scene, null, { gender: 'female', classId: 'guardian' })
  hero.applyEquipment({
    mainHand: 'guardian-heavy-sword', offHand: 'guardian-shield', armor: 'guardian-armor',
    helmet: 'kingdom-helmet', gloves: 'kingdom-gloves', boots: 'kingdom-boots',
  })
  assert.equal(scene.getTransformNodeByName('hero-right-hand-weapon-socket').parent, hero.joints.armRight)
  assert.equal(scene.getTransformNodeByName('hero-left-hand-equipment-socket').parent, hero.joints.armLeft)
  assert.equal(scene.getTransformNodeByName('equipment-guardian-armor').parent, hero.joints.torso)
  assert.equal(scene.getTransformNodeByName('equipment-kingdom-gloves-left').parent, hero.joints.armLeft)
  assert.equal(scene.getTransformNodeByName('equipment-kingdom-boots-left').parent, hero.joints.legLeft)
  assert.ok(scene.getMeshByName('kingdom-helmet-helm-cap'))
  assert.equal(hero.equipped.size, 6)
  scene.dispose()
  engine.dispose()
})

test('Warrior, Mage and Guardian starter weapons attach to their class loadouts', () => {
  for (const [classId, expectedWeapon] of [
    ['warrior', 'sunforged-blade'], ['mage', 'mage-staff'], ['guardian', 'guardian-heavy-sword'],
  ]) {
    const engine = new NullEngine()
    const scene = new Scene(engine)
    const hero = createHeroCharacter(scene, null, { gender: 'male', classId })
    hero.applyEquipment(createDefaultEquipment(classId))
    assert.equal(hero.equipped.get('mainHand').name, classId === 'warrior'
      ? 'hero-right-hand-weapon-socket' : `hero-right-hand-weapon-socket`)
    assert.equal(hero.equipped.size, classId === 'guardian' ? 3 : 2)
    if (classId === 'guardian') assert.equal(hero.equipped.get('offHand').parent, hero.joints.armLeft)
    if (classId === 'mage') assert.ok(scene.getMeshByName('mage-staff-focus-orb'))
    if (classId === 'warrior') assert.ok(scene.getMeshByName('wayfarer-sword-blade'))
    if (classId === 'guardian') assert.ok(scene.getMeshByName('guardian-heavy-sword-blade'))
    scene.dispose()
    engine.dispose()
  }
})

test('legacy version-four saves retain progression and migrate with a valid saved loadout', () => {
  const oldSave = createInitialProgress({ classId: 'mage' })
  oldSave.version = 4
  delete oldSave.equipment
  oldSave.inventory = [{ id: 'sunforged-blade', name: 'Wayfarer Blade', type: 'weapon' }, { id: 'sun-relic', name: 'Sun Relic', type: 'quest' }]
  oldSave.objectives.relic = true
  const storage = makeStorage(oldSave)
  const loaded = createRpgProgressStore(undefined, storage).getState()
  assert.equal(loaded.version, 10)
  assert.equal(loaded.objectives.relic, true)
  assert.ok(loaded.inventory.some(({ id }) => id === 'sun-relic'))
  assert.equal(loaded.equipment.mainHand, 'mage-staff')
  assert.ok(loaded.inventory.some(({ id }) => id === 'mage-wand'))
})

test('equipped loadouts persist and restore from the current save format', () => {
  const storage = makeStorage()
  const first = createRpgProgressStore({ classId: 'warrior' }, storage, { loadSaved: false })
  first.dispatch({
    type: 'restore',
    progress: {
      ...first.getState(),
      inventory: [
        ...first.getState().inventory,
        { id: 'warrior-axe', name: 'Warrior Axe', type: 'weapon' },
        { id: 'warrior-heavy-armor', name: 'Warrior Heavy Armor', type: 'armor' },
      ],
    },
  })
  first.dispatch({ type: 'equip-item', itemId: 'warrior-axe' }, { persist: true })
  first.dispatch({ type: 'equip-item', itemId: 'warrior-heavy-armor' }, { persist: true })
  const restored = createRpgProgressStore(undefined, storage).getState()
  assert.equal(restored.equipment.mainHand, 'warrior-axe')
  assert.equal(restored.equipment.armor, 'warrior-heavy-armor')
})
