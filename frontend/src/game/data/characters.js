export const characters = [
  {
    id: 'warrior',
    name: 'Warrior',
    epithet: 'The last of the sunforged',
    health: 120,
    attack: 30,
    color: 0xe7b75d,
    description: 'A battle-hardened vanguard with the strength to endure.',
    ability: {
      name: 'Sunforged strike',
      description: 'The strongest vitality and a dependable, balanced attack.',
    },
  },
  {
    id: 'mage',
    name: 'Mage',
    epithet: 'Keeper of the old stars',
    health: 80,
    attack: 42,
    color: 0x8c9cff,
    description: 'A keeper of old magic, striking hard but built for caution.',
    ability: {
      name: 'Astral burst',
      description: 'The most powerful strikes, balanced by lower vitality.',
    },
  },
  {
    id: 'guardian',
    name: 'Guardian',
    epithet: 'Oathbound to the wilds',
    health: 150,
    attack: 22,
    color: 0x75d4b0,
    description: 'A steadfast protector who can weather the longest fight.',
    ability: {
      name: 'Verdant resilience',
      description: 'The highest vitality, trading attack strength for endurance.',
    },
  },
]

export const appearanceOptions = {
  faces: [
    { id: 'wanderer', name: 'Wanderer', detail: 'Road-worn and ready' },
    { id: 'noble', name: 'Noble', detail: 'A composed, regal look' },
    { id: 'marked', name: 'Marked', detail: 'A rune-touched visage' },
  ],
  hairstyles: [
    { id: 'long', name: 'Flowing' },
    { id: 'cropped', name: 'Cropped' },
    { id: 'braided', name: 'Braided' },
    { id: 'crest', name: 'Crest' },
  ],
  skinTones: [
    { id: 'porcelain', name: 'Porcelain', color: '#f0d1b3' },
    { id: 'sand', name: 'Sand', color: '#d8ad84' },
    { id: 'bronze', name: 'Bronze', color: '#b87951' },
    { id: 'umber', name: 'Umber', color: '#875438' },
    { id: 'deep', name: 'Deep', color: '#57372f' },
  ],
  outfits: [
    { id: 'sunforged', name: 'Sunforged', color: '#b4874e', accent: '#e7c77f' },
    { id: 'astral', name: 'Astral', color: '#555b90', accent: '#b0baff' },
    { id: 'verdant', name: 'Verdant', color: '#416d60', accent: '#9ad9b7' },
  ],
}

export const defaultAppearance = {
  faceId: appearanceOptions.faces[0].id,
  hairstyleId: appearanceOptions.hairstyles[0].id,
  skinToneId: appearanceOptions.skinTones[2].id,
  outfitId: appearanceOptions.outfits[0].id,
}

export function getCharacter(characterId) {
  return characters.find((character) => character.id === characterId) ?? null
}

export function getAppearanceOption(category, optionId) {
  return appearanceOptions[category].find(({ id }) => id === optionId) ?? null
}
