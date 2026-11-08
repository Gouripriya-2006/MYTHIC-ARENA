import assert from 'node:assert/strict'
import test from 'node:test'
import {
  classifyAnimationClip,
  findAnimationClip,
  findMissingAnimationClips,
  interpolateAnimationWeights,
} from './animationClips.js'

test('recognizes common rigged humanoid movement and combat clip names', () => {
  assert.equal(classifyAnimationClip('Idle_01'), 'idle')
  assert.equal(classifyAnimationClip('Walking'), 'walk')
  assert.equal(classifyAnimationClip('Mixamo_Run'), 'run')
  assert.equal(classifyAnimationClip('Sprint_Fwd'), 'sprint')
  assert.equal(classifyAnimationClip('JumpStart'), 'jump')
  assert.equal(classifyAnimationClip('Dodge_Roll'), 'dodge')
  assert.equal(classifyAnimationClip('Heavy_Attack'), 'heavy-attack')
  assert.equal(classifyAnimationClip('BlockLoop'), 'block')
  assert.equal(classifyAnimationClip('Landing'), 'landing')
  assert.equal(classifyAnimationClip('DamageReaction'), 'hurt')
  assert.equal(classifyAnimationClip('Victory'), 'victory')
  assert.equal(classifyAnimationClip('Unknown'), null)
})

test('maps the requested Mixamo library names to player motions', () => {
  const clips = [
    ['Breathing Idle', 'idle'],
    ['Walking', 'walk'],
    ['Running', 'run'],
    ['Sprinting', 'sprint'],
    ['Jumping', 'jump'],
    ['Landing', 'landing'],
    ['Dodging', 'dodge'],
    ['Sword Attack', 'attack'],
    ['Sword And Shield Slash', 'attack'],
    ['Blocking', 'block'],
    ['Death', 'death'],
    ['Dying', 'death'],
  ]

  for (const [name, motion] of clips) assert.equal(classifyAnimationClip(name), motion, name)
})

test('uses a nearby supported locomotion clip when a requested clip is absent', () => {
  const groups = [{ name: 'Idle' }, { name: 'WalkForward' }, { name: 'Run' }]
  assert.equal(findAnimationClip(groups, 'run'), groups[2])
  assert.equal(findAnimationClip(groups, 'sprint'), groups[2])
  assert.equal(findAnimationClip(groups, 'jump'), groups[0])
  assert.equal(findAnimationClip(groups, 'attack'), groups[0])
})

test('crossfades from the current animation weights to the requested clip', () => {
  const idle = { name: 'Idle' }
  const walk = { name: 'Walk' }
  const groups = [idle, walk]
  const current = new Map([[idle, 0.4], [walk, 0.6]])

  assert.deepEqual([...interpolateAnimationWeights(groups, current, walk, 0)], [[idle, 0.4], [walk, 0.6]])
  assert.deepEqual([...interpolateAnimationWeights(groups, current, walk, 0.5)], [[idle, 0.2], [walk, 0.8]])
  assert.deepEqual([...interpolateAnimationWeights(groups, current, walk, 1)], [[idle, 0], [walk, 1]])
  assert.deepEqual([...interpolateAnimationWeights(groups, current, idle, -1)], [[idle, 0.4], [walk, 0.6]])
})

test('reports required Mixamo motions absent from a character export', () => {
  const groups = [
    { name: 'Breathing Idle' },
    { name: 'Walking' },
    { name: 'Running' },
    { name: 'Sprinting' },
    { name: 'Jumping' },
    { name: 'Landing' },
    { name: 'Dodging' },
    { name: 'Sword Attack' },
    { name: 'Blocking' },
    { name: 'Death' },
  ]
  const required = ['idle', 'walk', 'run', 'sprint', 'jump', 'landing', 'dodge', 'attack', 'block', 'death', 'heavy-attack']

  assert.deepEqual(findMissingAnimationClips(groups, required), ['heavy-attack'])
})
