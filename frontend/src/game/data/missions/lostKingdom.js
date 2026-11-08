export const lostKingdom = {
  id: 'the-lost-kingdom',
  title: 'The Lost Kingdom',
  subtitle: 'A realm swallowed by the Shattered Veil',
  description: 'Recover the Sun Relic, defeat the Veil Sentinel, and open the ancient gate.',
  world: { width: 960, height: 540 },
  playerStart: { x: 118, y: 380 },
  relic: { x: 403, y: 259 },
  sentinel: { x: 658, y: 280, health: 90, damage: 12 },
  gate: { x: 864, y: 273 },
  objectives: [
    { id: 'relic', label: 'Recover the Sun Relic' },
    { id: 'sentinel', label: 'Defeat the Veil Sentinel' },
    { id: 'gate', label: 'Reach the ancient gate' },
  ],
}
