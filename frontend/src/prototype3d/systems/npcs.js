export const NPCS = Object.freeze({
  keeper: {
    id: 'keeper',
    name: 'Veil Keeper',
    role: 'Last guardian of the kingdom',
    greeting: 'I am the last voice of this kingdom. Find the Sun Relic, silence its guardian, and open the eastern gate.',
    options: [
      {
        id: 'relic-lore',
        label: 'What happened to the Sun Relic?',
        response: 'The Relic rests at the old sanctum altar. When you claim it, the Veil Sentinel will wake.',
      },
      {
        id: 'journal',
        label: 'Review my quests',
        action: 'journal',
      },
    ],
  },
  quartermaster: {
    id: 'quartermaster',
    name: 'Bram Ironhand',
    role: 'Quartermaster',
    position: { x: 4.5, z: -4.5 },
    merchantId: 'quartermaster',
    greeting: 'Steel and leather still have a place in a world of curses. Tell me what you need for the road.',
    appearance: { robe: '#45535b', accent: '#c69a55', skin: '#bd8b69', style: 'smith' },
    options: [
      { id: 'shop', label: 'Browse weapons and armor', action: 'shop', merchantId: 'quartermaster' },
      {
        id: 'advice',
        label: 'What should I prepare for?',
        response: 'A sound shield turns aside more than blades. The Warden strikes hard; keep your guard and stamina ready.',
      },
      { id: 'journal', label: 'Check the kingdom’s quests', action: 'journal' },
    ],
  },
  apothecary: {
    id: 'apothecary',
    name: 'Lyra Thornbloom',
    role: 'Apothecary',
    position: { x: -8.5, z: -7.5 },
    merchantId: 'apothecary',
    greeting: 'The Veil leaves wounds that steel cannot mend. I keep remedies for the body and for spell-weary hands.',
    appearance: { robe: '#37584f', accent: '#87b78c', skin: '#d3a782', style: 'herbalist' },
    options: [
      { id: 'shop', label: 'Browse remedies and rations', action: 'shop', merchantId: 'apothecary' },
      {
        id: 'tonics',
        label: 'Which tonic should I carry?',
        response: 'Red tonics restore health. Blue tonics restore stamina. A field ration offers a little of both when you are worn down.',
      },
      { id: 'journal', label: 'Review supply quests', action: 'journal' },
    ],
  },
  scout: {
    id: 'scout',
    name: 'Eryn Vale',
    role: 'Royal pathfinder',
    position: { x: 0, z: -15 },
    greeting: 'I have walked the old roads since the kingdom fell. I can point you toward the Relic, the bridge, or the dangers beyond.',
    appearance: { robe: '#655044', accent: '#d2bd8c', skin: '#a97657', style: 'scout' },
    options: [
      {
        id: 'threats',
        label: 'Where are the hostile camps?',
        response: 'Goblins prowl west of the sanctum; archers watch the eastern approach. The Journal tracks any hunt you accept.',
      },
      { id: 'journal', label: 'Show me available quests', action: 'journal' },
      { id: 'map', label: 'Show me the realm map', action: 'map' },
    ],
  },
})

export function getNpcOption(npcId, optionId) {
  return NPCS[npcId]?.options.find((option) => option.id === optionId) ?? null
}
