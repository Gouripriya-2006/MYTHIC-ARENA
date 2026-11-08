import { characters } from '../data/characters.js'
import { isWithinPhaserAttackRange } from '../ai/voiceActionDispatcher.js'

export function executePhaserAttack(scene, { range = 104, inclusive = false, instantDefeat = false } = {}) {
  const state = scene.store.getState()
  if (state.status !== 'active' || scene.time.now - scene.lastAttack < 420) return false
  const activeEnemy = state.objectives.relic && state.sentinelHealth > 0
  if (instantDefeat && !activeEnemy) return false
  scene.lastAttack = scene.time.now
  scene.audio?.play('player-light')
  const distance = Math.hypot(scene.player.x - scene.sentinel.x, scene.player.y - scene.sentinel.y)
  const inRange = isWithinPhaserAttackRange(distance, range, { inclusive })
  if (activeEnemy && (instantDefeat || inRange)) {
    const previousHealth = state.sentinelHealth
    if (instantDefeat) scene.store.defeatSentinel()
    else scene.store.attackSentinel()
    const nextState = scene.store.getState()
    if (nextState.sentinelHealth < previousHealth) {
      scene.audio?.play('enemy-hit')
    }
    scene.sentinelBody.setAlpha(state.sentinelHealth <= characters.find(({ id }) => id === state.characterId).attack ? 0.16 : 0.48)
    scene.time.delayedCall(150, () => scene.sentinelBody?.setAlpha(1))
    if (nextState.objectives.sentinel) {
      scene.audio?.play('enemy-defeat')
      scene.sentinel.setVisible(false)
      scene.sentinelAura.destroy()
      scene.sentinelLabel.setVisible(false)
    }
    scene.onMessage(nextState.objectives.sentinel
      ? 'The Veil Sentinel crumbles. The ancient gate awaits.'
      : `A strike lands. Sentinel vitality: ${nextState.sentinelHealth}.`)
    scene.cameras.main.shake(90, 0.002)
    return instantDefeat
      ? nextState.sentinelHealth === 0 && nextState.objectives.sentinel
      : nextState.sentinelHealth < previousHealth
  } else if (state.sentinelHealth <= 0) {
    scene.onMessage('The sentinel is defeated. Reach the ancient gate and press E.')
  } else {
    scene.onMessage('Out of reach. Move closer to strike the sentinel.')
  }
  return false
}

export function executePhaserVoiceAction(scene, action) {
  if (!scene.canExecuteVoiceAction(action)) return false
  if (action === 'interact_nearest') {
    scene.interact()
    return true
  }
  if (action === 'light_attack') {
    return scene.attack({ instantDefeat: true }) === true
  }
  return false
}
