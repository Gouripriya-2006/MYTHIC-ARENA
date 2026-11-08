const CLIP_PATTERN = [
  ['idle', /idle|stand|breath/],
  ['sprint', /sprint|fast.?run/],
  ['run', /run/],
  ['walk', /walk|locomotion/],
  ['landing', /land|fallimpact/],
  ['jump', /jump/],
  ['dodge', /dodg(e|ing)|roll|evade/],
  ['block', /block|guard|defend/],
  ['magic', /magic|cast|spell/],
  ['hurt', /hurt|hitreact|damage/],
  ['death', /death|die|dying/],
  ['victory', /victory|celebrate|cheer/],
  ['heavy-attack', /heavy|powerattack/],
  ['attack', /attack|slash|sword/],
]

const MOTION_FALLBACKS = {
  sprint: ['run', 'walk', 'idle'],
  run: ['sprint', 'walk', 'idle'],
  walk: ['idle'],
  jump: ['idle'],
  landing: ['idle'],
  dodge: ['sprint', 'run', 'walk', 'idle'],
  magic: ['attack', 'idle'],
  hurt: ['idle'],
  death: ['idle'],
  victory: ['idle'],
  attack: ['idle'],
  'heavy-attack': ['attack', 'idle'],
  block: ['idle'],
}

export function classifyAnimationClip(name) {
  const normalized = name.toLowerCase().replace(/[^a-z]/g, '')
  return CLIP_PATTERN.find(([, pattern]) => pattern.test(normalized))?.[0] ?? null
}

export function findAnimationClip(groups, motion) {
  return groups.find((group) => classifyAnimationClip(group.name) === motion)
    ?? (MOTION_FALLBACKS[motion] ?? []).map((fallback) => (
      groups.find((group) => classifyAnimationClip(group.name) === fallback)
    )).find(Boolean)
}

export function findExactAnimationClip(groups, motion) {
  return groups.find((group) => classifyAnimationClip(group.name) === motion)
}

export function findMissingAnimationClips(groups, requiredMotions) {
  const available = new Set(groups.map((group) => classifyAnimationClip(group.name)).filter(Boolean))
  return requiredMotions.filter((motion) => !available.has(motion))
}

export function interpolateAnimationWeights(groups, fromWeights, target, progress) {
  const amount = Math.max(0, Math.min(1, progress))
  return new Map(groups.map((group) => {
    const from = fromWeights.get(group) ?? 0
    const to = group === target ? 1 : 0
    return [group, from + (to - from) * amount]
  }))
}
