export const TUTORIAL_STEPS = Object.freeze([
  {
    title: 'Welcome, Wayfarer',
    description: 'The Lost Kingdom has fallen beneath the Shattered Veil. Find the Sun Relic, defeat the guardians, and open the ancient gate. This guide teaches the controls and the tools you will use along the way.',
    guidance: ['Use Next to begin, or Skip Tutorial to explore on your own.'],
    targets: [],
    requirements: [],
  },
  {
    title: 'Move through the realm',
    description: 'Explore with W, A, S, and D. Hold Shift while moving to sprint, and press Space to jump. Drag the mouse on the world to turn the camera.',
    guidance: ['Walk, sprint, jump, and drag the camera once to try each control.'],
    targets: ['.prototype-controls'],
    requirements: ['move', 'sprint', 'jump', 'camera'],
  },
  {
    title: 'Learn to fight safely',
    description: 'J is a quick light attack; K is a slower, stronger heavy attack. Ctrl dodges, and B holds your guard. Attacks and guarding use stamina; watch the green bar. Your health is the red bar.',
    guidance: ['Try each control on the marked training target. It uses real attacks, never fights back, and gives no quest or combat rewards.'],
    targets: ['.rpg-combat-actions'],
    requirements: ['light-attack', 'heavy-attack', 'dodge', 'guard'],
  },
  {
    title: 'Your pack and equipment',
    description: 'Open Inventory to compare weapons, armor, and shields. Rarity and stat lines show what an item changes. Equip or unequip gear to update your real loadout.',
    guidance: ['Open Inventory, then try equipping and unequipping a piece of gear you own.'],
    targets: ['[data-ui-action="inventory"]'],
    requirements: ['inventory-open', 'equipment-equipped', 'equipment-unequipped'],
  },
  {
    title: 'Use a potion when you need it',
    description: 'Health Potions restore health; Mana Potions restore stamina for this prototype. In Inventory, use a potion when its matching bar is below maximum. A potion cannot be used at full strength.',
    guidance: ['Open Inventory to see potion effects. Try each Use action when health or stamina is below maximum.'],
    targets: ['[data-ui-action="inventory"]'],
    requirements: ['health-potion', 'stamina-potion'],
  },
  {
    title: 'Follow your quests',
    description: 'The Journal lists main and side quests, objectives, progress, and rewards. Speak with the Veil Keeper to begin the story, accept available charges, and use Track to choose an objective.',
    guidance: ['Open the Journal. Accept a quest and use Track to choose what to follow.'],
    targets: ['[data-ui-action="journal"]'],
    requirements: ['journal-open', 'quest-accepted', 'quest-tracked'],
  },
  {
    title: 'Find your way',
    description: 'The minimap is in the upper-right of the screen. Open the world map for the Keeper, Sun Relic, Sentinel, Warden, and gate markers.',
    guidance: ['Open the minimap or press M to inspect the world map.'],
    targets: ['.rpg-minimap'],
    requirements: ['map-open'],
  },
  {
    title: 'Grow stronger with skills',
    description: 'Earn one skill point each time you level up. Open Skills to see your class-specific path and its level, point, and prerequisite requirements. Choose an available skill to apply a permanent gameplay bonus.',
    guidance: ['Inspect your class tree. When you have a skill point, purchase an available skill to see its bonus take effect.'],
    targets: ['[data-ui-action="skills"]'],
    requirements: ['skills-open', 'skill-purchased'],
  },
])

export const TUTORIAL_EVENTS = Object.freeze(TUTORIAL_STEPS.flatMap(({ requirements }) => requirements))

export function createTutorialProgress(status = 'active') {
  return { status, step: 0, confirmations: [] }
}

export function normalizeTutorialProgress(value, { returningPlayer = false } = {}) {
  if (!value || typeof value !== 'object') {
    return createTutorialProgress(returningPlayer ? 'not-started' : 'active')
  }
  const validStatus = ['active', 'completed', 'skipped', 'not-started'].includes(value.status)
  const status = validStatus ? value.status : (returningPlayer ? 'not-started' : 'active')
  const step = Number.isInteger(value.step) ? Math.min(TUTORIAL_STEPS.length - 1, Math.max(0, value.step)) : 0
  const confirmations = [...new Set((Array.isArray(value.confirmations) ? value.confirmations : [])
    .filter((event) => TUTORIAL_EVENTS.includes(event)))]
  return { status, step, confirmations }
}

export function reduceTutorialProgress(tutorial, action) {
  if (action.type === 'tutorial-start' || action.type === 'tutorial-replay') {
    return { status: 'active', step: 0, confirmations: [] }
  }
  if (action.type === 'tutorial-skip') {
    return tutorial.status === 'active' ? { ...tutorial, status: 'skipped' } : tutorial
  }
  if (action.type === 'tutorial-back') {
    return tutorial.status === 'active' && tutorial.step > 0
      ? { ...tutorial, step: tutorial.step - 1 }
      : tutorial
  }
  if (action.type === 'tutorial-next') {
    if (tutorial.status !== 'active') return tutorial
    if (tutorial.step === TUTORIAL_STEPS.length - 1) return { ...tutorial, status: 'completed' }
    return { ...tutorial, step: tutorial.step + 1 }
  }
  if (action.type === 'tutorial-event') {
    const requirements = TUTORIAL_STEPS[tutorial.step]?.requirements ?? []
    if (tutorial.status !== 'active'
      || !requirements.includes(action.event)
      || tutorial.confirmations.includes(action.event)) return tutorial
    return { ...tutorial, confirmations: [...tutorial.confirmations, action.event] }
  }
  return tutorial
}
