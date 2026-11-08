import { defaultAppearance, getAppearanceOption, getCharacter } from '../data/characters.js'
import { lostKingdom } from '../data/missions/lostKingdom.js'

export function createInitialState(selection) {
  const legacySelection = typeof selection === 'string'
  const heroSelection = legacySelection
    ? { classId: selection }
    : selection
  const characterId = heroSelection?.classId ?? heroSelection?.characterId
  const character = getCharacter(characterId)
  if (!character) {
    throw new Error(`Unknown character: ${characterId}`)
  }

  const name = typeof heroSelection.name === 'string'
    ? heroSelection.name.trim()
    : legacySelection
      ? character.name
      : ''
  if (!name) {
    throw new Error('Hero name is required.')
  }
  if (name.length > 24) {
    throw new Error('Hero name must be 24 characters or fewer.')
  }

  const gender = heroSelection.gender ?? 'male'
  if (gender !== 'male' && gender !== 'female') {
    throw new Error(`Unknown hero gender: ${gender}`)
  }

  const appearance = { ...defaultAppearance, ...heroSelection.appearance }
  const appearanceCategories = {
    faceId: 'faces',
    hairstyleId: 'hairstyles',
    skinToneId: 'skinTones',
    outfitId: 'outfits',
  }
  Object.entries(appearanceCategories).forEach(([key, category]) => {
    if (!getAppearanceOption(category, appearance[key])) {
      throw new Error(`Unknown ${key}: ${appearance[key]}`)
    }
  })

  return {
    characterId: character.id,
    hero: {
      name,
      gender,
      classId: character.id,
      appearance,
    },
    missionId: lostKingdom.id,
    health: character.health,
    maxHealth: character.health,
    player: { ...lostKingdom.playerStart },
    sentinelHealth: lostKingdom.sentinel.health,
    objectives: Object.fromEntries(lostKingdom.objectives.map(({ id }) => [id, false])),
    status: 'active',
  }
}
