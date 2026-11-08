import assert from 'node:assert/strict'
import test from 'node:test'
import { canExecuteArenaVoiceAction } from './voiceActionRules.js'

const state = (overrides = {}) => ({ status: 'active', stamina: 40, ...overrides })
const intent = (action, parameters = {}) => ({ action, parameters })

function rules(overrides = {}) {
  const requestedRanges = []
  return {
    requestedRanges,
    options: {
      classId: 'warrior',
      findNearestInteraction: () => true,
      findNearestActiveEnemy: () => true,
      findAttackTarget(range) { requestedRanges.push(range); return true },
      abilityCooldownRemaining: 0,
      abilityCost: 28,
      abilityRange: 5.2,
      canUseItem: (_state, itemId) => itemId === 'health-potion',
      ...overrides,
    },
  }
}

test('Babylon voice action rules allow all five supported actions with eligible live-state fixtures', () => {
  const { options } = rules()
  for (const action of ['interact_nearest', 'light_attack', 'heavy_attack', 'class_ability']) {
    assert.equal(canExecuteArenaVoiceAction(intent(action), state(), options), true, action)
  }
  assert.equal(canExecuteArenaVoiceAction(intent('use_consumable', { itemId: 'health-potion' }), state(), options), true)
})

test('Babylon voice light attack accepts distant active enemies while heavy attack retains its range', () => {
  const reach = rules()
  assert.equal(canExecuteArenaVoiceAction(intent('light_attack'), state(), reach.options), true)
  assert.deepEqual(reach.requestedRanges, [], 'light attack validation does not request a range-limited target')
  reach.requestedRanges.length = 0
  assert.equal(canExecuteArenaVoiceAction(intent('heavy_attack'), state(), reach.options), true)
  assert.deepEqual(reach.requestedRanges, [3.8])

  const noTarget = rules({ findNearestActiveEnemy: () => false, findAttackTarget: () => false })
  assert.equal(canExecuteArenaVoiceAction(intent('light_attack'), state(), noTarget.options), false)
  assert.equal(canExecuteArenaVoiceAction(intent('heavy_attack'), state(), noTarget.options), false)
  assert.equal(canExecuteArenaVoiceAction(intent('light_attack'), state({ stamina: 13 }), rules().options), false)
  assert.equal(canExecuteArenaVoiceAction(intent('heavy_attack'), state({ stamina: 29 }), rules().options), false)
})

test('Babylon voice action rules enforce ability cooldown, class-specific cost, target reach and pause state', () => {
  const { options } = rules()
  assert.equal(canExecuteArenaVoiceAction(intent('class_ability'), state({ stamina: 27 }), options), false)
  assert.equal(canExecuteArenaVoiceAction(intent('class_ability'), state(), rules({ abilityCooldownRemaining: 0.01 }).options), false)
  assert.equal(canExecuteArenaVoiceAction(intent('class_ability'), state(), rules({ findAttackTarget: () => false }).options), false)
  assert.equal(canExecuteArenaVoiceAction(intent('class_ability'), state(), rules({ classId: 'guardian' }).options), true)
  assert.equal(canExecuteArenaVoiceAction(intent('class_ability'), state(), rules({ paused: true }).options), false)
})

test('Babylon voice action rules enforce valid proximity, consumable availability and active mission state', () => {
  assert.equal(canExecuteArenaVoiceAction(intent('interact_nearest'), state(), rules({ findNearestInteraction: () => false }).options), false)
  assert.equal(canExecuteArenaVoiceAction(intent('use_consumable', { itemId: 'unknown-item' }), state(), rules().options), false)
  assert.equal(canExecuteArenaVoiceAction(intent('light_attack'), state({ status: 'defeat' }), rules().options), false)
  assert.equal(canExecuteArenaVoiceAction(intent('light_attack'), state(), rules({ paused: true }).options), false)
  assert.equal(canExecuteArenaVoiceAction(intent('teleport'), state(), rules().options), false)
})
