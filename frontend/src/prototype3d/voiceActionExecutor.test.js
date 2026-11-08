import assert from 'node:assert/strict'
import test from 'node:test'
import { executeBabylonVoiceIntent } from './voiceActionExecutor.js'

const action = (name, parameters = {}) => ({ action: name, parameters })

test('Babylon voice executor delegates every allowlisted action to its existing game handler', () => {
  const events = []
  const arena = { controller: {
    setVirtualKey: (...args) => events.push(['interact', ...args]),
    startAttack: (type) => events.push(['attack', type]),
    triggerAbility: () => events.push(['ability']),
  } }
  const handleHudAction = (...args) => events.push(['hud', ...args])

  for (const intent of [
    action('interact_nearest'),
    action('light_attack'),
    action('heavy_attack'),
    action('class_ability'),
    action('use_consumable', { itemId: 'health-potion' }),
  ]) {
    assert.equal(executeBabylonVoiceIntent(intent, { arena, handleHudAction }), true, intent.action)
  }

  assert.deepEqual(events, [
    ['interact', 'e', true],
    ['attack', 'light'],
    ['attack', 'heavy'],
    ['ability'],
    ['hud', 'use-item', 'health-potion'],
  ])
})

test('Babylon voice executor refuses missing controllers and unsupported actions', () => {
  const events = []
  const options = {
    arena: { controller: { startAttack: () => events.push('attack') } },
    handleHudAction: () => events.push('hud'),
  }
  assert.equal(executeBabylonVoiceIntent(action('teleport'), options), false)
  assert.equal(executeBabylonVoiceIntent(action('light_attack'), { ...options, arena: null }), false)
  assert.deepEqual(events, [])
})
