export const CLASS_NAMES = Object.freeze({
  warrior: 'Warrior',
  mage: 'Mage',
  guardian: 'Guardian',
})

export const SKILL_TREES = Object.freeze({
  warrior: [
    { id: 'warrior-mastery-1', classId: 'warrior', name: 'Weapon Mastery I', description: 'Improve melee damage with disciplined weapon forms.', level: 2, cost: 1, bonuses: { meleeDamage: 0.14 } },
    { id: 'warrior-mastery-2', classId: 'warrior', name: 'Weapon Mastery II', description: 'Build on your training for heavier, more damaging strikes.', level: 3, cost: 1, requires: ['warrior-mastery-1'], bonuses: { meleeDamage: 0.14 } },
    { id: 'warrior-mastery-3', classId: 'warrior', name: 'Weapon Mastery III', description: 'Reach the final rank of weapon mastery.', level: 4, cost: 1, requires: ['warrior-mastery-2'], bonuses: { meleeDamage: 0.14 } },
    { id: 'warrior-vitality', classId: 'warrior', name: 'Iron Vitality', description: 'Increase maximum health by 15.', level: 2, cost: 1, bonuses: { maxHealth: 15 } },
    { id: 'warrior-endurance', classId: 'warrior', name: 'Lasting Resolve', description: 'Increase maximum stamina by 15.', level: 4, cost: 1, requires: ['warrior-vitality'], bonuses: { maxStamina: 15 } },
    { id: 'warrior-iron-wall', classId: 'warrior', name: 'Iron Wall', description: 'Reduce incoming damage by 6%.', level: 3, cost: 1, requires: ['warrior-vitality'], bonuses: { defense: 0.06 } },
    { id: 'warrior-swift-step', classId: 'warrior', name: 'Swift Step', description: 'Increase movement speed by 6%.', level: 5, cost: 1, requires: ['warrior-iron-wall'], bonuses: { movementSpeed: 0.06 } },
    { id: 'warrior-precision', classId: 'warrior', name: 'Keen Edge', description: 'Gain 5% critical hit chance.', level: 4, cost: 1, requires: ['warrior-mastery-1'], bonuses: { criticalChance: 0.05 } },
    { id: 'warrior-heavy-impact', classId: 'warrior', name: 'Heavy Impact', description: 'Increase heavy attack damage by 18%.', level: 5, cost: 1, requires: ['warrior-mastery-2'], bonuses: { heavyDamage: 0.18 } },
    { id: 'warrior-warcry', classId: 'warrior', name: 'Ravager Technique', description: 'Increase class ability damage by 20%.', level: 6, cost: 2, requires: ['warrior-mastery-3'], bonuses: { abilityDamage: 0.2 } },
  ],
  mage: [
    { id: 'mage-focus-1', classId: 'mage', name: 'Astral Focus I', description: 'Increase spell damage by 18% and reduce ability stamina cost by 3.', level: 2, cost: 1, bonuses: { spellDamage: 0.18, abilityCostReduction: 3 } },
    { id: 'mage-focus-2', classId: 'mage', name: 'Astral Focus II', description: 'Deepen your spell power and reduce ability stamina cost by 3.', level: 3, cost: 1, requires: ['mage-focus-1'], bonuses: { spellDamage: 0.18, abilityCostReduction: 3 } },
    { id: 'mage-focus-3', classId: 'mage', name: 'Astral Focus III', description: 'Reach the final rank of Astral Focus.', level: 4, cost: 1, requires: ['mage-focus-2'], bonuses: { spellDamage: 0.18, abilityCostReduction: 3 } },
    { id: 'mage-vitality', classId: 'mage', name: 'Aether Reserves', description: 'Increase maximum stamina by 18.', level: 2, cost: 1, bonuses: { maxStamina: 18 } },
    { id: 'mage-veil-step', classId: 'mage', name: 'Veil Step', description: 'Increase movement speed by 7%.', level: 3, cost: 1, requires: ['mage-vitality'], bonuses: { movementSpeed: 0.07 } },
    { id: 'mage-life-ward', classId: 'mage', name: 'Astral Ward', description: 'Increase maximum health by 12.', level: 4, cost: 1, requires: ['mage-vitality'], bonuses: { maxHealth: 12 } },
    { id: 'mage-cooldown', classId: 'mage', name: 'Lucid Casting', description: 'Reduce class ability cooldown by 15%.', level: 4, cost: 1, requires: ['mage-focus-1'], bonuses: { cooldownReduction: 0.15 } },
    { id: 'mage-bolt-range', classId: 'mage', name: 'Far-Seeking Bolt', description: 'Extend Astral Bolt range by 5 metres.', level: 5, cost: 1, requires: ['mage-focus-2'], bonuses: { abilityRange: 5 } },
    { id: 'mage-precision', classId: 'mage', name: 'Arcane Precision', description: 'Gain 6% critical hit chance.', level: 5, cost: 1, requires: ['mage-focus-1'], bonuses: { criticalChance: 0.06 } },
    { id: 'mage-ward', classId: 'mage', name: 'Runic Ward', description: 'Reduce incoming damage by 5%.', level: 5, cost: 1, requires: ['mage-vitality'], bonuses: { defense: 0.05 } },
    { id: 'mage-astral-surge', classId: 'mage', name: 'Astral Surge', description: 'Increase class ability damage by 22%.', level: 6, cost: 2, requires: ['mage-focus-3'], bonuses: { abilityDamage: 0.22 } },
  ],
  guardian: [
    { id: 'guardian-resilience-1', classId: 'guardian', name: 'Verdant Resilience I', description: 'Gain 12 maximum health and reduce incoming damage by 8%.', level: 2, cost: 1, bonuses: { maxHealth: 12, defense: 0.08 } },
    { id: 'guardian-resilience-2', classId: 'guardian', name: 'Verdant Resilience II', description: 'Gain 12 maximum health and reduce incoming damage by 8%.', level: 3, cost: 1, requires: ['guardian-resilience-1'], bonuses: { maxHealth: 12, defense: 0.08 } },
    { id: 'guardian-resilience-3', classId: 'guardian', name: 'Verdant Resilience III', description: 'Reach the final rank of Verdant Resilience.', level: 4, cost: 1, requires: ['guardian-resilience-2'], bonuses: { maxHealth: 12, defense: 0.08 } },
    { id: 'guardian-endurance', classId: 'guardian', name: 'Stalwart Endurance', description: 'Increase maximum stamina by 18.', level: 2, cost: 1, bonuses: { maxStamina: 18 } },
    { id: 'guardian-bulwark', classId: 'guardian', name: 'Bulwark', description: 'Reduce incoming damage by 6% and strengthen blocks by 20%.', level: 3, cost: 1, requires: ['guardian-resilience-1'], bonuses: { defense: 0.06, shieldStrength: 0.2 } },
    { id: 'guardian-counter', classId: 'guardian', name: 'Measured Reprisal', description: 'Counter a successful block with a strike for 60% of the attack damage.', level: 4, cost: 1, requires: ['guardian-bulwark'], bonuses: { counterDamage: 0.6 } },
    { id: 'guardian-vanguard', classId: 'guardian', name: 'Vanguard Training', description: 'Increase melee damage by 12%.', level: 4, cost: 1, requires: ['guardian-resilience-1'], bonuses: { meleeDamage: 0.12 } },
    { id: 'guardian-swift', classId: 'guardian', name: 'Swift Guard', description: 'Increase movement speed by 5%.', level: 5, cost: 1, requires: ['guardian-bulwark'], bonuses: { movementSpeed: 0.05 } },
    { id: 'guardian-precision', classId: 'guardian', name: 'Guardian Precision', description: 'Gain 5% critical hit chance.', level: 5, cost: 1, requires: ['guardian-vanguard'], bonuses: { criticalChance: 0.05 } },
    { id: 'guardian-protection', classId: 'guardian', name: 'Living Aegis', description: 'Extend the protection granted by your class ability by 2 seconds.', level: 6, cost: 2, requires: ['guardian-counter'], bonuses: { abilityDuration: 2 } },
  ],
})

export const SKILLS_BY_ID = Object.freeze(Object.fromEntries(
  Object.values(SKILL_TREES).flat().map((skill) => [skill.id, skill]),
))

const LEGACY_SKILL_IDS = Object.freeze({
  mastery: ['warrior-mastery-1', 'warrior-mastery-2', 'warrior-mastery-3'],
  focus: ['mage-focus-1', 'mage-focus-2', 'mage-focus-3'],
  resilience: ['guardian-resilience-1', 'guardian-resilience-2', 'guardian-resilience-3'],
})

export function getSkillBonuses(state) {
  const bonuses = {
    maxHealth: 0,
    maxStamina: 0,
    meleeDamage: 0,
    spellDamage: 0,
    heavyDamage: 0,
    abilityDamage: 0,
    defense: 0,
    movementSpeed: 0,
    criticalChance: 0,
    cooldownReduction: 0,
    abilityRange: 0,
    abilityDuration: 0,
    abilityCostReduction: 0,
    shieldStrength: 0,
    counterDamage: 0,
  }
  for (const id of state?.unlockedSkills ?? []) {
    const skill = SKILLS_BY_ID[id]
    if (!skill || skill.classId !== state.hero?.classId) continue
    for (const [stat, value] of Object.entries(skill.bonuses)) bonuses[stat] += value
  }
  return bonuses
}

export function getSkillLockReason(state, skillId) {
  const skill = SKILLS_BY_ID[skillId]
  if (!skill) return 'UNKNOWN SKILL'
  if (state.hero?.classId !== skill.classId) return 'CLASS LOCKED'
  if (state.unlockedSkills?.includes(skillId)) return 'UNLOCKED'
  if (state.level < skill.level) return `REQUIRES LEVEL ${skill.level}`
  if (!(skill.requires ?? []).every((id) => state.unlockedSkills?.includes(id))) return 'PREREQUISITE NEEDED'
  if (state.skillPoints < skill.cost) return `NEEDS ${skill.cost} POINT${skill.cost === 1 ? '' : 'S'}`
  return ''
}

export function canUnlockSkill(state, skillId) {
  return getSkillLockReason(state, skillId) === ''
}

export function getLegacySkillIds(classId, rank) {
  const skillName = { warrior: 'mastery', mage: 'focus', guardian: 'resilience' }[classId]
  return LEGACY_SKILL_IDS[skillName]?.slice(0, Math.max(0, Math.min(3, rank))) ?? []
}

export function getLegacySkillForId(skillId) {
  return Object.entries(LEGACY_SKILL_IDS).find(([, ids]) => ids.includes(skillId))?.[0] ?? null
}
