import { ENEMY_ARCHETYPES, ENEMY_REWARDS } from './enemyArchetypes.js'
import { canEquipItem, createDefaultEquipment, createStarterInventory, EQUIPMENT_BY_ID, EQUIPMENT_SLOTS, getEquipmentStats } from './equipment.js'
import { addInventoryItem, canDiscardItem, normalizeInventory, removeInventoryItem, useConsumable } from './inventory.js'
import { getEnemyLoot, getItemDefinition } from './inventoryItems.js'
import {
  canUnlockSkill,
  getLegacySkillForId,
  getLegacySkillIds,
  getSkillBonuses,
  SKILLS_BY_ID,
} from './skillTree.js'
import {
  createQuestLog,
  getQuestAvailability,
  normalizeQuestLog,
  QUESTS_BY_ID,
} from './quests.js'
import { createTutorialProgress, normalizeTutorialProgress, reduceTutorialProgress } from './tutorial.js'
import {
  buyMerchantItem,
  createMerchantStock,
  MERCHANTS,
  normalizeMerchantStock,
  sellMerchantItem,
} from './merchants.js'

export const SAVE_KEY = 'mythic-arena-3d-save-v1'
const SAVE_VERSION = 10
const EXTRA_ENEMY_STATES = Object.fromEntries(ENEMY_ARCHETYPES.map(({ id, health }) => [
  id,
  { health, maxHealth: health, defeated: false },
]))
const EXTRA_ENEMY_REWARDS = Object.fromEntries(ENEMY_ARCHETYPES.map(({ id }) => [
  id,
  { pending: false, collected: false, loot: null },
]))
const ENEMY_IDS = Object.keys(ENEMY_REWARDS)

const CLASS_STATS = {
  warrior: { health: 120, stamina: 110 },
  mage: { health: 80, stamina: 130 },
  guardian: { health: 150, stamina: 120 },
}

export function createInitialProgress(hero = {}) {
  if (!hero || typeof hero !== 'object') hero = {}
  const classId = CLASS_STATS[hero.classId] ? hero.classId : 'warrior'
  const stats = CLASS_STATS[classId]
  return {
    version: SAVE_VERSION,
    hero: {
      name: typeof hero.name === 'string' && hero.name.trim() ? hero.name.trim().slice(0, 24) : 'Wayfarer',
      classId,
      gender: hero.gender === 'female' ? 'female' : 'male',
      appearance: { ...(hero.appearance ?? {}) },
    },
    position: { x: 0, y: 0, z: -7 },
    health: stats.health,
    maxHealth: stats.health,
    stamina: stats.stamina,
    maxStamina: stats.stamina,
    xp: 0,
    level: 1,
    gold: 0,
    merchantStock: createMerchantStock(),
    inventory: normalizeInventory(createStarterInventory(classId)),
    equipment: createDefaultEquipment(classId),
    objectives: { briefing: false, relic: false, sentinel: false, boss: false, gate: false },
    questLog: createQuestLog(),
    tutorial: createTutorialProgress(),
    enemies: {
      sentinel: { health: 100, maxHealth: 100, defeated: false },
      boss: { health: 260, maxHealth: 260, defeated: false, phase: 1 },
      ...Object.fromEntries(Object.entries(EXTRA_ENEMY_STATES).map(([id, enemy]) => [id, { ...enemy }])),
    },
    enemyRewards: {
      sentinel: { pending: false, collected: false, loot: null },
      boss: { pending: false, collected: false, loot: null },
      ...Object.fromEntries(Object.entries(EXTRA_ENEMY_REWARDS).map(([id, reward]) => [id, { ...reward }])),
    },
    skillPoints: 0,
    skills: { mastery: 0, focus: 0, resilience: 0 },
    unlockedSkills: [],
    settings: { master: 1, music: 0.7, effects: 0.8, muted: false },
    status: 'active',
  }
}

export function reduceRpgProgress(state, action) {
  if (state.status !== 'active' && !['restore', 'resume-after-defeat'].includes(action.type)) return state

  switch (action.type) {
    case 'resume-after-defeat':
      return state.status === 'defeat'
        ? { ...state, health: state.maxHealth, status: 'active' }
        : state
    case 'tutorial-start':
    case 'tutorial-replay':
    case 'tutorial-skip':
    case 'tutorial-back':
    case 'tutorial-next':
    case 'tutorial-event': {
      const tutorial = reduceTutorialProgress(state.tutorial, action)
      return tutorial === state.tutorial ? state : { ...state, tutorial }
    }
    case 'move':
      return { ...state, position: { ...action.position } }
    case 'spend-stamina':
      if (!Number.isFinite(action.amount) || action.amount <= 0 || state.stamina < action.amount) return state
      return { ...state, stamina: Math.max(0, state.stamina - action.amount) }
    case 'regenerate-stamina':
      if (!Number.isFinite(action.amount) || action.amount <= 0) return state
      return {
        ...state,
        stamina: Math.min(state.maxStamina, state.stamina + Math.max(0, action.amount)),
      }
    case 'damage-player': {
      if (!Number.isFinite(action.amount) || action.amount <= 0) return state
      const reduction = Math.min(0.6, getSkillBonuses(state).defense + getEquipmentStats(state.equipment).damageReduction)
      const damage = Math.max(1, Math.ceil(action.amount * (1 - reduction)))
      const health = Math.max(0, state.health - damage)
      return { ...state, health, status: health === 0 ? 'defeat' : state.status }
    }
    case 'heal-player': {
      if (!Number.isFinite(action.amount) || action.amount <= 0) return state
      return { ...state, health: Math.min(state.maxHealth, state.health + action.amount) }
    }
    case 'use-item':
      return useConsumable(state, action.itemId)
    case 'buy-item': {
      const purchased = buyMerchantItem(state, action.merchantId, action.itemId)
      return purchased === state
        ? state
        : applyQuestEvent(purchased, 'collect', action.itemId)
    }
    case 'sell-item':
      return sellMerchantItem(state, action.merchantId, action.itemId)
    case 'discard-item': {
      if (!canDiscardItem(action.itemId, state.inventory) || !state.inventory.some(({ id }) => id === action.itemId)) return state
      const current = state.inventory.find(({ id }) => id === action.itemId)
      return { ...state, inventory: removeInventoryItem(state.inventory, action.itemId, action.quantity ?? current.quantity ?? 1) }
    }
    case 'purchase-skill': {
      let skillId = action.skillId
      if (['mastery', 'focus', 'resilience'].includes(skillId)) {
        const classSkill = { warrior: 'mastery', mage: 'focus', guardian: 'resilience' }[state.hero.classId]
        if (skillId !== classSkill) return state
        skillId = getLegacySkillIds(state.hero.classId, state.skills[skillId] + 1).at(-1)
      }
      const skill = SKILLS_BY_ID[skillId]
      if (!skill || !canUnlockSkill(state, skillId)) return state
      const unlockedSkills = [...state.unlockedSkills, skillId]
      const legacySkill = getLegacySkillForId(skillId)
      const skills = legacySkill
        ? { ...state.skills, [legacySkill]: state.skills[legacySkill] + 1 }
        : state.skills
      const maxHealth = state.maxHealth + (skill.bonuses.maxHealth ?? 0)
      const maxStamina = state.maxStamina + (skill.bonuses.maxStamina ?? 0)
      return {
        ...state,
        skills,
        unlockedSkills,
        skillPoints: state.skillPoints - skill.cost,
        maxHealth,
        health: Math.min(maxHealth, state.health + (skill.bonuses.maxHealth ?? 0)),
        maxStamina,
        stamina: Math.min(maxStamina, state.stamina + (skill.bonuses.maxStamina ?? 0)),
      }
    }
    case 'equip-item': {
      const item = EQUIPMENT_BY_ID[action.itemId]
      if (!item || !canEquipItem(action.itemId, state.hero.classId, state.inventory)) return state
      return { ...state, equipment: { ...state.equipment, [item.slot]: item.id } }
    }
    case 'unequip-item':
      if (!EQUIPMENT_SLOTS.includes(action.slot) || !state.equipment[action.slot]) return state
      return { ...state, equipment: { ...state.equipment, [action.slot]: null } }
    case 'update-settings':
      if (!action.settings || typeof action.settings !== 'object') return state
      return {
        ...state,
        settings: {
          master: clampVolume(action.settings.master, state.settings.master),
          music: clampVolume(action.settings.music, state.settings.music),
          effects: clampVolume(action.settings.effects, state.settings.effects),
          muted: typeof action.settings.muted === 'boolean' ? action.settings.muted : state.settings.muted,
        },
      }
    case 'briefing':
      return state.objectives.briefing
        ? applyQuestEvent(state, 'interact', 'keeper')
        : reduceRpgProgress(state, {
          type: 'accept-quest',
          questId: 'main-keepers-charge',
          npcId: 'keeper',
        })
    case 'accept-quest': {
      if (getQuestAvailability(state.questLog, action.questId)) return state
      const quest = QUESTS_BY_ID[action.questId]
      const interacted = action.npcId === 'keeper'
        ? { ...state, objectives: { ...state.objectives, briefing: true } }
        : state
      const questLog = {
        ...interacted.questLog,
        active: [...interacted.questLog.active, action.questId],
        trackedId: interacted.questLog.trackedId && interacted.questLog.active.includes(interacted.questLog.trackedId)
          ? interacted.questLog.trackedId
          : action.questId,
        progress: {
          ...interacted.questLog.progress,
          [action.questId]: Object.fromEntries(quest.objectives.map((objective) => [
            objective.id,
            getKnownObjectiveProgress(interacted, objective),
          ])),
        },
      }
      let accepted = { ...interacted, questLog }
      if (action.npcId) accepted = applyQuestEvent(accepted, 'interact', action.npcId)
      if (quest.objectives.every(({ id, count }) => accepted.questLog.progress[action.questId]?.[id] >= count)) {
        accepted = completeQuest(accepted, action.questId)
      }
      return accepted
    }
    case 'track-quest':
      if (action.questId !== null
        && !state.questLog.active.includes(action.questId)
        && !state.questLog.completed.includes(action.questId)) return state
      return { ...state, questLog: { ...state.questLog, trackedId: action.questId } }
    case 'quest-event':
      return applyQuestEvent(state, action.eventType, action.targetId, action.amount)
    case 'quest-location':
      return applyQuestEvent(state, 'location', action.locationId)
    case 'claim-quest-items': {
      const items = state.questLog.pendingItems[action.questId]
      if (!items?.length || !state.questLog.completed.includes(action.questId)) return state
      let inventory = state.inventory
      for (const item of items) {
        const added = addInventoryItem(inventory, item.itemId, item.quantity)
        if (added.remaining) return state
        inventory = added.inventory
      }
      const pendingItems = { ...state.questLog.pendingItems }
      delete pendingItems[action.questId]
      return { ...state, inventory, questLog: { ...state.questLog, pendingItems } }
    }
    case 'grant-xp':
      return grantExperience(state, action.amount)
    case 'collect-relic': {
      if (state.objectives.relic) return state
      const rewarded = grantExperience(state, 60)
      const pickedUp = addInventoryItem(rewarded.inventory, 'sun-relic')
      if (pickedUp.remaining) return state
      return applyQuestEvent({
        ...rewarded,
        objectives: { ...state.objectives, relic: true },
        inventory: pickedUp.inventory,
      }, 'collect', 'sun-relic')
    }
    case 'collect-cache': {
      if (state.inventory.some(({ id }) => id === 'ancient-cache')) return state
      const rewarded = grantExperience(state, 35)
      const pickedUp = addInventoryItem(rewarded.inventory, 'ancient-cache')
      if (pickedUp.remaining) return state
      return applyQuestEvent({
        ...rewarded,
        gold: rewarded.gold + 50,
        inventory: pickedUp.inventory,
      }, 'interact', 'cache')
    }
    case 'damage-enemy': {
      const enemy = state.enemies[action.enemyId]
      const reward = ENEMY_REWARDS[action.enemyId]
      if (!enemy || !reward || enemy.defeated || !Number.isFinite(action.amount) || action.amount <= 0) return state
      const health = Math.max(0, enemy.health - action.amount)
      const defeated = health === 0
      const enemyRewards = defeated
        ? { ...state.enemyRewards, [action.enemyId]: { pending: true, collected: false, loot: getEnemyLoot(action.enemyId) } }
        : state.enemyRewards
      const nextState = {
        ...state,
        enemyRewards,
        enemies: {
          ...state.enemies,
          [action.enemyId]: {
            ...enemy,
            health,
            defeated,
            phase: action.enemyId === 'boss'
              ? health <= enemy.maxHealth * 0.4 ? 3 : health <= enemy.maxHealth * 0.7 ? 2 : 1
              : enemy.phase ?? 1,
          },
        },
      }
      if (!defeated) return nextState
      const bossDefeated = action.enemyId === 'boss'
      const leveled = grantExperience(nextState, reward.xp)
      return applyQuestEvent({
        ...leveled,
        objectives: {
          ...leveled.objectives,
          sentinel: action.enemyId === 'sentinel' || leveled.objectives.sentinel,
          boss: bossDefeated || leveled.objectives.boss,
        },
      }, action.enemyId === 'boss' ? 'boss' : 'defeat', action.enemyId)
    }
    case 'collect-enemy-reward': {
      const reward = state.enemyRewards[action.enemyId]
      if (!reward?.pending || reward.collected) return state
      const gold = ENEMY_REWARDS[action.enemyId]?.gold
      if (!Number.isFinite(gold) || gold <= 0) return state
      const loot = reward.loot
      const added = loot ? addInventoryItem(state.inventory, loot.itemId, loot.quantity) : { inventory: state.inventory, remaining: 0 }
      if (added.remaining) return state
      return applyQuestEvent({
        ...state,
        gold: state.gold + gold,
        inventory: added.inventory,
        enemyRewards: {
          ...state.enemyRewards,
          [action.enemyId]: { pending: false, collected: true, loot: null },
        },
      }, 'collect', loot?.itemId, loot?.quantity ?? 1)
    }
    case 'open-gate': {
      if (!state.objectives.relic || !state.objectives.sentinel || !state.objectives.boss || state.objectives.gate) return state
      const rewarded = grantExperience(state, 100)
      let inventory = rewarded.inventory
      for (const enemyId of ENEMY_IDS) {
        const loot = state.enemyRewards[enemyId].pending ? state.enemyRewards[enemyId].loot : null
        if (!loot) continue
        const pickup = addInventoryItem(inventory, loot.itemId, loot.quantity)
        if (pickup.remaining) return state
        inventory = pickup.inventory
      }
      const pendingGold = ENEMY_IDS.reduce((total, enemyId) => (
        total + (state.enemyRewards[enemyId].pending ? ENEMY_REWARDS[enemyId].gold : 0)
      ), 0)
      let completed = {
        ...rewarded,
        inventory,
        gold: rewarded.gold + 100 + pendingGold,
        enemyRewards: Object.fromEntries(ENEMY_IDS.map((enemyId) => [
          enemyId,
          { pending: false, collected: true, loot: null },
        ])),
        objectives: { ...state.objectives, gate: true },
        status: 'victory',
      }
      for (const enemyId of ENEMY_IDS) {
        const loot = state.enemyRewards[enemyId].pending ? state.enemyRewards[enemyId].loot : null
        if (loot) completed = applyQuestEvent(completed, 'collect', loot.itemId, loot.quantity)
      }
      return applyQuestEvent(completed, 'interact', 'gate')
    }
    case 'restore':
      return isValidProgress(action.progress) ? action.progress : state
    default:
      return state
  }
}

function applyQuestEvent(state, eventType, targetId, amount = 1) {
  if (!eventType || !targetId || !Number.isFinite(amount) || amount <= 0) return state
  let next = state
  const count = Math.floor(amount)
  let questLog = state.questLog
  if (eventType === 'interact' && !questLog.interactions.includes(targetId)) {
    questLog = { ...questLog, interactions: [...questLog.interactions, targetId] }
  } else if (eventType === 'location' && !questLog.locations.includes(targetId)) {
    questLog = { ...questLog, locations: [...questLog.locations, targetId] }
  } else if (eventType === 'collect' && count > 0) {
    questLog = {
      ...questLog,
      collectedItems: {
        ...questLog.collectedItems,
        [targetId]: (questLog.collectedItems[targetId] ?? 0) + count,
      },
    }
  }
  if (questLog !== state.questLog) next = { ...state, questLog }
  const active = [...state.questLog.active]
  for (const questId of active) {
    const quest = QUESTS_BY_ID[questId]
    const progress = { ...next.questLog.progress[questId] }
    let changed = false
    for (const objective of quest.objectives) {
      if (objective.type !== eventType || objective.target !== targetId) continue
      const current = progress[objective.id] ?? 0
      if (current >= objective.count) continue
      progress[objective.id] = Math.min(objective.count, current + count)
      changed = true
    }
    if (!changed) continue
    next = {
      ...next,
      questLog: {
        ...next.questLog,
        progress: { ...next.questLog.progress, [questId]: progress },
      },
    }
    if (quest.objectives.every(({ id, count }) => progress[id] >= count)) {
      next = completeQuest(next, questId)
    }
  }
  return next
}

function getKnownObjectiveProgress(state, objective) {
  if (objective.type === 'defeat' || objective.type === 'boss') {
    return state.enemies?.[objective.target]?.defeated ? objective.count : 0
  }
  if (objective.type === 'collect') {
    if (objective.target === 'sun-relic' && state.objectives.relic) return objective.count
    return Math.min(objective.count, state.questLog?.collectedItems?.[objective.target] ?? 0)
  }
  if (objective.type === 'location') {
    return state.questLog?.locations?.includes(objective.target) ? objective.count : 0
  }
  if (objective.type === 'interact') {
    const alreadyInteracted = state.questLog?.interactions?.includes(objective.target)
      || (objective.target === 'keeper' && state.objectives.briefing)
      || (objective.target === 'cache' && state.inventory.some(({ id }) => id === 'ancient-cache'))
      || (objective.target === 'gate' && state.objectives.gate)
    return alreadyInteracted ? objective.count : 0
  }
  return 0
}

function completeQuest(state, questId) {
  const quest = QUESTS_BY_ID[questId]
  if (!quest || !state.questLog.active.includes(questId) || state.questLog.rewarded.includes(questId)) return state
  let rewarded = grantExperience(state, quest.rewards.xp ?? 0)
  let inventory = rewarded.inventory
  const pending = []
  for (const item of quest.rewards.items ?? []) {
    const added = addInventoryItem(inventory, item.itemId, item.quantity)
    inventory = added.inventory
    if (added.remaining) pending.push({ itemId: item.itemId, quantity: added.remaining })
  }
  const pendingItems = { ...state.questLog.pendingItems }
  if (pending.length) pendingItems[questId] = pending
  const completed = {
    ...rewarded,
    inventory,
    gold: rewarded.gold + (quest.rewards.gold ?? 0),
    skillPoints: rewarded.skillPoints + (quest.rewards.skillPoints ?? 0),
    questLog: {
      ...rewarded.questLog,
      active: rewarded.questLog.active.filter((id) => id !== questId),
      completed: [...rewarded.questLog.completed, questId],
      rewarded: [...rewarded.questLog.rewarded, questId],
      pendingItems,
    },
  }
  return completed
}

export function createRpgProgressStore(hero, storage = globalThis.localStorage, {
  loadSaved = true,
  onPersistenceError = () => {},
} = {}) {
  let state = (loadSaved ? loadProgress(storage) : null) ?? createInitialProgress(hero)
  const listeners = new Set()
  let persistenceUnavailable = false

  function persistState() {
    const saved = saveProgress(storage, state)
    if (!saved && storage) {
      if (!persistenceUnavailable) {
        try {
          onPersistenceError()
        } catch (error) {
          console.error('Unable to report a 3D progress save failure.', error)
        }
      }
      persistenceUnavailable = true
    } else if (saved) persistenceUnavailable = false
    return saved
  }

  function notifyListeners() {
    for (const listener of listeners) {
      try {
        listener(state)
      } catch (error) {
        console.error('Unable to update a 3D game view after progress changed.', error)
      }
    }
  }

  function dispatch(action, { persist = false } = {}) {
    const next = reduceRpgProgress(state, action)
    if (next === state) return state
    state = next
    notifyListeners()
    if (persist) persistState()
    return state
  }

  return {
    getState: () => state,
    dispatch,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    save: persistState,
    reset() {
      state = createInitialProgress(hero)
      persistState()
      notifyListeners()
    },
  }
}

export function loadProgress(storage = globalThis.localStorage) {
  if (!storage) return null
  let serialized
  try {
    serialized = storage.getItem(SAVE_KEY)
  } catch (error) {
    console.warn('Unable to read the saved 3D RPG progress.', error)
    return null
  }
  if (!serialized) return null
  let parsed
  try {
    parsed = JSON.parse(serialized)
  } catch (error) {
    console.warn('The saved 3D RPG progress is malformed.', error)
    return null
  }
  let migrated = false
  if (parsed?.version === 1) {
    parsed = migrateVersionOneProgress(parsed)
    migrated = true
  } else if (parsed?.version === 2) {
    parsed = migrateVersionTwoProgress(parsed)
    migrated = true
  } else if (parsed?.version === 3) {
    migrated = true
  }
  if (parsed?.version === 3) parsed = migrateVersionThreeProgress(parsed)
  if (parsed?.version === 4) {
    parsed = migrateVersionFourProgress(parsed)
    migrated = true
  }
  if (parsed?.version === 5) {
    parsed = migrateVersionFiveProgress(parsed)
    migrated = true
  }
  if (parsed?.version === 6) {
    parsed = migrateVersionSixProgress(parsed)
    migrated = true
  }
  if (parsed?.version === 7) {
    parsed = migrateVersionSevenProgress(parsed)
    migrated = true
  }
  if (parsed?.version === 8) {
    parsed = migrateVersionEightProgress(parsed)
    migrated = true
  }
  if (parsed?.version === 9) {
    parsed = migrateVersionNineProgress(parsed)
    migrated = true
  } else if (parsed?.version === SAVE_VERSION) {
    const normalized = normalizeCurrentProgress(parsed)
    migrated = migrated || normalized !== parsed
    parsed = normalized
  }
  if (!isValidProgress(parsed)) {
    console.warn('The saved 3D RPG progress has an unsupported or invalid shape.')
    return null
  }
  if (migrated) saveProgress(storage, parsed)
  return parsed
}

function migrateVersionOneProgress(state) {
  const completed = Boolean(state.objectives?.gate)
  return migrateVersionTwoProgress({
    ...state,
    version: 2,
    objectives: { ...state.objectives, boss: completed },
    enemies: {
      ...state.enemies,
      boss: { health: completed ? 0 : 260, maxHealth: 260, defeated: completed, phase: 1 },
    },
    skillPoints: Math.max(0, state.level - 1),
    skills: { mastery: 0, focus: 0, resilience: 0 },
    settings: { master: 1, music: 0.7, effects: 0.8, muted: false },
  })
}

function migrateVersionTwoProgress(state) {
  return {
    ...state,
    version: 3,
    enemyRewards: {
      sentinel: { pending: false, collected: Boolean(state.enemies?.sentinel?.defeated) },
      boss: { pending: false, collected: Boolean(state.enemies?.boss?.defeated) },
    },
  }
}

function migrateVersionThreeProgress(state) {
  return {
    ...state,
    version: 4,
    enemies: {
      ...Object.fromEntries(Object.entries(EXTRA_ENEMY_STATES).map(([id, enemy]) => [id, { ...enemy }])),
      ...state.enemies,
    },
    enemyRewards: {
      sentinel: { pending: false, collected: false },
      boss: { pending: false, collected: false },
      ...Object.fromEntries(Object.entries(EXTRA_ENEMY_REWARDS).map(([id, reward]) => [id, { ...reward }])),
      ...state.enemyRewards,
    },
  }
}

function migrateVersionFourProgress(state) {
  const starterInventory = createStarterInventory()
  const savedInventory = Array.isArray(state.inventory) ? state.inventory : []
  const existingIds = new Set(savedInventory.map(({ id }) => id))
  return {
    ...state,
    version: 5,
    inventory: [...savedInventory, ...starterInventory.filter(({ id }) => !existingIds.has(id))],
    equipment: state.equipment ?? createDefaultEquipment(state.hero.classId),
  }
}

function migrateVersionFiveProgress(state) {
  let inventory = normalizeInventory(state.inventory)
  for (const itemId of ['health-potion', 'mana-potion']) {
    if (!inventory.some(({ id }) => id === itemId)) {
      inventory = addInventoryItem(inventory, itemId, 3).inventory
    }
  }
  const enemyRewards = Object.fromEntries(ENEMY_IDS.map((enemyId) => {
    const old = state.enemyRewards?.[enemyId] ?? { pending: false, collected: false }
    return [enemyId, { pending: Boolean(old.pending), collected: Boolean(old.collected), loot: old.loot ?? null }]
  }))
  return { ...state, version: 6, inventory, enemyRewards }
}

function migrateVersionSixProgress(state) {
  const skills = normalizeLegacySkills(state.skills)
  return normalizeSkillProgress({
    ...state,
    version: 7,
    skills,
    unlockedSkills: getLegacySkillIds(state.hero?.classId, skills[{ warrior: 'mastery', mage: 'focus', guardian: 'resilience' }[state.hero?.classId]]),
  })
}

function migrateVersionSevenProgress(state) {
  const savedObjectives = state.objectives ?? {}
  const completed = [
    savedObjectives.briefing && 'main-keepers-charge',
    savedObjectives.relic && 'main-sun-relic',
    savedObjectives.sentinel && 'main-sentinel',
    savedObjectives.boss && 'main-warden',
    savedObjectives.gate && 'main-dawn',
  ].filter(Boolean)
  const nextMainQuest = ['main-keepers-charge', 'main-sun-relic', 'main-sentinel', 'main-warden', 'main-dawn']
    .find((id) => !completed.includes(id))
  const questLog = {
    ...createQuestLog(),
    completed,
    rewarded: [...completed],
    active: nextMainQuest ? [nextMainQuest] : [],
    trackedId: nextMainQuest ?? completed.at(-1) ?? null,
    progress: Object.fromEntries([
      ...completed.map((id) => [id, Object.fromEntries(QUESTS_BY_ID[id].objectives.map(({ id: objectiveId, count }) => [objectiveId, count]))]),
      ...(nextMainQuest ? [[nextMainQuest, Object.fromEntries(QUESTS_BY_ID[nextMainQuest].objectives.map((objective) => [
        objective.id,
        getKnownObjectiveProgress(state, objective),
      ]))]] : []),
    ]),
    interactions: [
      ...(savedObjectives.briefing ? ['keeper'] : []),
      ...(savedObjectives.gate ? ['gate'] : []),
      ...(state.inventory?.some(({ id }) => id === 'ancient-cache') ? ['cache'] : []),
    ],
  }
  return { ...state, version: 8, questLog }
}

function migrateVersionEightProgress(state) {
  return normalizeCurrentProgress({
    ...state,
    version: 9,
    tutorial: normalizeTutorialProgress(state.tutorial, { returningPlayer: true }),
  })
}

function migrateVersionNineProgress(state) {
  return normalizeCurrentProgress({
    ...state,
    version: SAVE_VERSION,
    merchantStock: createMerchantStock(),
  })
}

function normalizeCurrentProgress(state) {
  const normalizedSkills = normalizeSkillProgress(state)
  const questLog = normalizeQuestLog(state.questLog)
  const tutorial = normalizeTutorialProgress(state.tutorial, { returningPlayer: true })
  const merchantStock = normalizeMerchantStock(state.merchantStock)
  const boss = state.enemies?.boss
  const bossPhase = Number.isInteger(boss?.phase) && boss.phase >= 1 && boss.phase <= 3
    ? boss.phase
    : boss?.health <= boss?.maxHealth * 0.4 ? 3 : boss?.health <= boss?.maxHealth * 0.7 ? 2 : 1
  const enemies = !boss || boss.phase === bossPhase
    ? state.enemies
    : { ...state.enemies, boss: { ...boss, phase: bossPhase } }
  if (normalizedSkills === state
    && JSON.stringify(questLog) === JSON.stringify(state.questLog)
    && JSON.stringify(tutorial) === JSON.stringify(state.tutorial)
    && JSON.stringify(merchantStock) === JSON.stringify(state.merchantStock)
    && enemies === state.enemies) return state
  return { ...normalizedSkills, version: SAVE_VERSION, questLog, tutorial, merchantStock, enemies }
}

function normalizeSkillProgress(state) {
  if (!state || typeof state !== 'object') return state
  const skills = normalizeLegacySkills(state.skills)
  const classId = state.hero?.classId
  const legacySkill = { warrior: 'mastery', mage: 'focus', guardian: 'resilience' }[classId]
  const input = Array.isArray(state.unlockedSkills)
    ? state.unlockedSkills
    : getLegacySkillIds(classId, skills[legacySkill])
  const unlockedSkills = [...new Set(input.filter((id) => (
    typeof id === 'string' && SKILLS_BY_ID[id]?.classId === classId
  )))]
  const normalized = {
    ...state,
    skills,
    skillPoints: Number.isInteger(state.skillPoints) && state.skillPoints >= 0 ? state.skillPoints : 0,
    unlockedSkills,
  }
  return Array.isArray(state.unlockedSkills)
    && state.skills?.mastery === skills.mastery
    && state.skills?.focus === skills.focus
    && state.skills?.resilience === skills.resilience
    && state.skillPoints === normalized.skillPoints
    && unlockedSkills.length === input.length
      ? state
      : normalized
}

function normalizeLegacySkills(skills) {
  const normalized = {}
  for (const id of ['mastery', 'focus', 'resilience']) {
    normalized[id] = Number.isInteger(skills?.[id]) ? Math.min(3, Math.max(0, skills[id])) : 0
  }
  return normalized
}

export function saveProgress(storage = globalThis.localStorage, state) {
  if (!storage) return false
  try {
    storage.setItem(SAVE_KEY, JSON.stringify(state))
    return true
  } catch (error) {
    console.warn('Unable to save 3D RPG progress. The current session will continue.', error)
    return false
  }
}

function grantExperience(state, amount) {
  let xp = state.xp + amount
  let level = state.level
  let health = state.health
  let maxHealth = state.maxHealth
  let maxStamina = state.maxStamina
  let stamina = state.stamina
  let gold = state.gold
  let skillPoints = state.skillPoints
  let inventory = [...state.inventory]

  while (xp >= level * 100) {
    xp -= level * 100
    level += 1
    skillPoints += 1
    maxHealth += 10
    health += 10
    maxStamina += 5
    stamina += 5
    gold += 25
    inventory = addInventoryItem(inventory, 'level-rune').inventory
  }

  return { ...state, xp, level, health, maxHealth, stamina, maxStamina, gold, skillPoints, inventory }
}

function clampVolume(value, previous) {
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : previous
}

function isValidProgress(value) {
  return value?.version === SAVE_VERSION
    && typeof value.hero?.name === 'string'
    && value.hero.name.trim().length > 0
    && CLASS_STATS[value.hero.classId] !== undefined
    && ['male', 'female'].includes(value.hero.gender)
    && Number.isFinite(value.position?.x)
    && Number.isFinite(value.position?.y)
    && Number.isFinite(value.position?.z)
    && Number.isInteger(value.level)
    && value.level >= 1
    && Number.isFinite(value.gold)
    && value.gold >= 0
    && isValidMerchantStock(value.merchantStock)
    && Number.isFinite(value.health)
    && Number.isFinite(value.maxHealth)
    && value.maxHealth > 0
    && value.health >= 0
    && value.health <= value.maxHealth
    && Number.isFinite(value.stamina)
    && Number.isFinite(value.maxStamina)
    && value.maxStamina > 0
    && value.stamina >= 0
    && value.stamina <= value.maxStamina
    && Number.isFinite(value.xp)
    && value.xp >= 0
    && Number.isInteger(value.skillPoints)
    && value.skillPoints >= 0
    && ['mastery', 'focus', 'resilience'].every((skill) => Number.isInteger(value.skills?.[skill])
      && value.skills[skill] >= 0
      && value.skills[skill] <= 3)
    && Array.isArray(value.unlockedSkills)
    && new Set(value.unlockedSkills).size === value.unlockedSkills.length
    && value.unlockedSkills.every((id) => typeof id === 'string'
      && SKILLS_BY_ID[id]?.classId === value.hero.classId)
    && isValidQuestLog(value.questLog)
    && value.tutorial && ['active', 'completed', 'skipped', 'not-started'].includes(value.tutorial.status)
    && Number.isInteger(value.tutorial.step) && value.tutorial.step >= 0
    && value.tutorial.step < 8
    && Array.isArray(value.tutorial.confirmations)
    && value.tutorial.confirmations.every((event) => typeof event === 'string')
    && ['master', 'music', 'effects'].every((setting) => Number.isFinite(value.settings?.[setting])
      && value.settings[setting] >= 0
      && value.settings[setting] <= 1)
    && typeof value.settings?.muted === 'boolean'
    && Array.isArray(value.inventory)
    && value.inventory.every((item) => item && typeof item.id === 'string'
      && typeof item.name === 'string'
      && typeof item.type === 'string'
      && (item.quantity === undefined || Number.isInteger(item.quantity) && item.quantity > 0
        && item.quantity <= (getItemDefinition(item)?.stackable ? getItemDefinition(item).maxStack ?? 20 : 1)))
    && value.equipment && EQUIPMENT_SLOTS.every((slot) => (
      value.equipment[slot] === null
      || (typeof value.equipment[slot] === 'string'
        && EQUIPMENT_BY_ID[value.equipment[slot]]?.slot === slot
        && EQUIPMENT_BY_ID[value.equipment[slot]].classes.includes(value.hero.classId))
    ))
    && ['active', 'victory', 'defeat'].includes(value.status)
    && typeof value.objectives?.briefing === 'boolean'
    && typeof value.objectives?.relic === 'boolean'
    && typeof value.objectives?.sentinel === 'boolean'
    && typeof value.objectives?.boss === 'boolean'
    && typeof value.objectives?.gate === 'boolean'
    && Number.isFinite(value.enemies?.sentinel?.health)
    && Number.isFinite(value.enemies.sentinel.maxHealth)
    && value.enemies.sentinel.health >= 0
    && value.enemies.sentinel.health <= value.enemies.sentinel.maxHealth
    && typeof value.enemies.sentinel.defeated === 'boolean'
    && Number.isFinite(value.enemies?.boss?.health)
    && Number.isFinite(value.enemies.boss.maxHealth)
    && value.enemies.boss.health >= 0
    && value.enemies.boss.health <= value.enemies.boss.maxHealth
    && typeof value.enemies.boss.defeated === 'boolean'
    && Number.isInteger(value.enemies.boss.phase)
    && value.enemies.boss.phase >= 1
    && value.enemies.boss.phase <= 3
    && typeof value.enemyRewards?.sentinel?.pending === 'boolean'
    && typeof value.enemyRewards?.sentinel?.collected === 'boolean'
    && isValidLoot(value.enemyRewards.sentinel.loot)
    && typeof value.enemyRewards?.boss?.pending === 'boolean'
    && typeof value.enemyRewards?.boss?.collected === 'boolean'
    && isValidLoot(value.enemyRewards.boss.loot)
    && ENEMY_ARCHETYPES.every(({ id }) => (
      Number.isFinite(value.enemies?.[id]?.health)
      && Number.isFinite(value.enemies[id].maxHealth)
      && value.enemies[id].health >= 0
      && value.enemies[id].health <= value.enemies[id].maxHealth
      && typeof value.enemies[id].defeated === 'boolean'
      && typeof value.enemyRewards?.[id]?.pending === 'boolean'
      && typeof value.enemyRewards[id].collected === 'boolean'
      && (value.enemyRewards[id].loot === undefined || value.enemyRewards[id].loot === null
        || (typeof value.enemyRewards[id].loot.itemId === 'string'
          && getItemDefinition(value.enemyRewards[id].loot.itemId)?.stackable
          && Number.isInteger(value.enemyRewards[id].loot.quantity)
          && value.enemyRewards[id].loot.quantity > 0))
    ))
}

function isValidQuestLog(value) {
  return Boolean(value
    && Array.isArray(value.active)
    && value.active.every((id) => Boolean(QUESTS_BY_ID[id]))
    && Array.isArray(value.completed)
    && value.completed.every((id) => Boolean(QUESTS_BY_ID[id]))
    && value.active.every((id) => !value.completed.includes(id))
    && Array.isArray(value.rewarded)
    && value.rewarded.every((id) => value.completed.includes(id))
    && (value.trackedId === null
      || value.active.includes(value.trackedId)
      || value.completed.includes(value.trackedId))
    && value.progress && typeof value.progress === 'object'
    && value.pendingItems && typeof value.pendingItems === 'object')
}

function isValidLoot(loot) {
  return loot === undefined || loot === null
    || (typeof loot.itemId === 'string'
      && Boolean(getItemDefinition(loot.itemId)?.stackable)
      && Number.isInteger(loot.quantity)
      && loot.quantity > 0)
}

function isValidMerchantStock(value) {
  return Boolean(value
    && Object.entries(MERCHANTS).every(([merchantId, merchant]) => (
      Object.keys(merchant.stock).every((itemId) => (
        Number.isInteger(value[merchantId]?.[itemId])
        && value[merchantId][itemId] >= 0
        && value[merchantId][itemId] <= 99
      ))
    )))
}
