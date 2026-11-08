export const QUESTS = Object.freeze([
  {
    id: 'main-keepers-charge',
    kind: 'main',
    name: 'The Keeper’s Charge',
    giver: 'Veil Keeper',
    giverId: 'keeper',
    description: 'Hear the last guardian of the kingdom and take up the search for the Sun Relic.',
    prerequisites: [],
    objectives: [{ id: 'keeper', type: 'interact', target: 'keeper', count: 1, label: 'Speak with the Veil Keeper' }],
    rewards: { xp: 25, gold: 15 },
  },
  {
    id: 'main-sun-relic',
    kind: 'main',
    name: 'Light Beneath the Veil',
    giver: 'Veil Keeper',
    giverId: 'keeper',
    description: 'Recover the Sun Relic from its altar and learn what stirs in the sanctum.',
    prerequisites: ['main-keepers-charge'],
    objectives: [{ id: 'relic', type: 'collect', target: 'sun-relic', count: 1, label: 'Recover the Sun Relic' }],
    rewards: { xp: 60, gold: 20 },
  },
  {
    id: 'main-sentinel',
    kind: 'main',
    name: 'The Sentinel’s Fall',
    giver: 'Veil Keeper',
    giverId: 'keeper',
    description: 'Defeat the Veil Sentinel and clear the way toward the Warden.',
    prerequisites: ['main-sun-relic'],
    objectives: [{ id: 'sentinel', type: 'defeat', target: 'sentinel', count: 1, label: 'Defeat the Veil Sentinel' }],
    rewards: { xp: 80, gold: 35 },
  },
  {
    id: 'main-warden',
    kind: 'main',
    name: 'Warden of the Veil',
    giver: 'Veil Keeper',
    giverId: 'keeper',
    description: 'Face Ravana, Warden of the Veil, and break the final defense of the Lost Kingdom.',
    prerequisites: ['main-sentinel'],
    objectives: [{ id: 'warden', type: 'boss', target: 'boss', count: 1, label: 'Defeat Ravana, Warden of the Veil' }],
    rewards: { xp: 120, gold: 60, skillPoints: 1 },
  },
  {
    id: 'main-dawn',
    kind: 'main',
    name: 'A Kingdom at Dawn',
    giver: 'Veil Keeper',
    giverId: 'keeper',
    description: 'Open the ancient gate and restore the Sun Relic’s light to the kingdom.',
    prerequisites: ['main-warden'],
    objectives: [{ id: 'gate', type: 'interact', target: 'gate', count: 1, label: 'Open the ancient gate' }],
    rewards: { xp: 100, gold: 100 },
  },
  {
    id: 'side-hunters-trail',
    kind: 'side',
    name: 'A Hunter’s Trail',
    giver: 'Eryn Vale',
    giverId: 'scout',
    description: 'Thin the hostile ranks gathering beyond the relic altar.',
    prerequisites: [],
    objectives: [
      { id: 'goblin', type: 'defeat', target: 'goblin', count: 1, label: 'Defeat a Goblin Warrior' },
      { id: 'archer', type: 'defeat', target: 'darkArcher', count: 1, label: 'Defeat a Dark Archer' },
    ],
    rewards: { xp: 90, gold: 45, skillPoints: 1 },
  },
  {
    id: 'side-restock',
    kind: 'side',
    name: 'Supplies for the Road',
    giver: 'Lyra Thornbloom',
    giverId: 'apothecary',
    description: 'Gather restorative tonics to prepare for the Warden.',
    prerequisites: [],
    objectives: [{ id: 'tonics', type: 'collect', target: 'health-potion', count: 2, label: 'Collect 2 Health Potions' }],
    rewards: { xp: 45, gold: 25 },
  },
  {
    id: 'side-hidden-cache',
    kind: 'side',
    name: 'The Sanctum’s Secret',
    giver: 'Veil Keeper',
    giverId: 'keeper',
    description: 'Find the old cache hidden among the sanctum ruins.',
    prerequisites: [],
    objectives: [{ id: 'cache', type: 'interact', target: 'cache', count: 1, label: 'Discover the hidden Sanctum Cache' }],
    rewards: { xp: 55, gold: 30, items: [{ itemId: 'health-potion', quantity: 1 }] },
  },
  {
    id: 'side-bridge-survey',
    kind: 'side',
    name: 'Across the Broken Span',
    giver: 'Eryn Vale',
    giverId: 'scout',
    description: 'Survey the old stone bridge and find a safe route through the river crossing.',
    prerequisites: [],
    objectives: [{ id: 'bridge', type: 'location', target: 'bridge', count: 1, label: 'Reach the stone bridge across the river' }],
    rewards: { xp: 65, gold: 30, items: [{ itemId: 'mana-potion', quantity: 1 }] },
  },
])

export const QUESTS_BY_ID = Object.freeze(Object.fromEntries(QUESTS.map((quest) => [quest.id, quest])))

export function createQuestLog() {
  return {
    active: [],
    completed: [],
    trackedId: null,
    progress: {},
    rewarded: [],
    pendingItems: {},
    interactions: [],
    locations: [],
    collectedItems: {},
  }
}

export function getQuestAvailability(questLog, questId) {
  const quest = QUESTS_BY_ID[questId]
  if (!quest) return 'Unknown quest.'
  if (questLog.completed.includes(questId)) return 'Already completed.'
  if (questLog.active.includes(questId)) return 'Already active.'
  if (!quest.prerequisites.every((id) => questLog.completed.includes(id))) return 'Complete the previous main quest first.'
  if (quest.kind === 'main' && QUESTS.some((entry) => entry.kind === 'main' && questLog.active.includes(entry.id))) {
    return 'Finish your active main quest first.'
  }
  return ''
}

export function getQuestProgress(questLog, quest) {
  return quest.objectives.map((objective) => ({
    ...objective,
    value: Math.min(objective.count, questLog.progress[quest.id]?.[objective.id] ?? 0),
  }))
}

export function normalizeQuestLog(value) {
  const log = createQuestLog()
  if (!value || typeof value !== 'object') return log
  const completed = [...new Set((Array.isArray(value.completed) ? value.completed : [])
    .filter((id) => Boolean(QUESTS_BY_ID[id])))]
  const active = [...new Set((Array.isArray(value.active) ? value.active : [])
    .filter((id) => Boolean(QUESTS_BY_ID[id]) && !completed.includes(id)))]
    .filter((id) => QUESTS_BY_ID[id].prerequisites.every((prerequisite) => completed.includes(prerequisite)))
  const progress = {}
  for (const id of [...active, ...completed]) {
    const quest = QUESTS_BY_ID[id]
    const saved = value.progress?.[id]
    progress[id] = Object.fromEntries(quest.objectives.map((objective) => {
      const current = saved?.[objective.id]
      return [objective.id, Number.isInteger(current) ? Math.min(objective.count, Math.max(0, current)) : 0]
    }))
  }
  const trackedId = typeof value.trackedId === 'string'
    && (active.includes(value.trackedId) || completed.includes(value.trackedId))
    ? value.trackedId
    : active[0] ?? null
  const rewarded = [...new Set((Array.isArray(value.rewarded) ? value.rewarded : [])
    .filter((id) => completed.includes(id)))]
  const pendingItems = Object.fromEntries(Object.entries(value.pendingItems ?? {})
    .filter(([id, items]) => completed.includes(id) && Array.isArray(items) && items.every((item) => (
      typeof item?.itemId === 'string' && Number.isInteger(item.quantity) && item.quantity > 0
    ))))
  const interactions = [...new Set((Array.isArray(value.interactions) ? value.interactions : [])
    .filter((id) => typeof id === 'string'))]
  const locations = [...new Set((Array.isArray(value.locations) ? value.locations : [])
    .filter((id) => typeof id === 'string'))]
  const collectedItems = Object.fromEntries(Object.entries(value.collectedItems ?? {})
    .filter(([id, count]) => typeof id === 'string' && Number.isInteger(count) && count > 0))
  return { active, completed, trackedId, progress, rewarded, pendingItems, interactions, locations, collectedItems }
}
