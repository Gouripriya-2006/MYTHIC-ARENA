import { getCharacter } from '../data/characters.js'
import { lostKingdom } from '../data/missions/lostKingdom.js'
import { createInitialState } from './initialState.js'
import { applyAttack, applyDamage } from '../systems/combatSystem.js'
import { completeObjective } from '../systems/objectiveSystem.js'

export function createGameStore(heroSelection) {
  let state = createInitialState(heroSelection)
  const listeners = new Set()
  const character = getCharacter(state.characterId)

  function commit(nextState) {
    if (nextState === state) return
    state = nextState
    listeners.forEach((listener) => listener(state))
  }

  return {
    getState: () => state,
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    setPlayerPosition(x, y) {
      if (!Number.isFinite(x) || !Number.isFinite(y) || state.status !== 'active') return
      const nextX = Math.max(24, Math.min(lostKingdom.world.width - 24, x))
      const nextY = Math.max(42, Math.min(lostKingdom.world.height - 30, y))
      if (nextX === state.player.x && nextY === state.player.y) return
      commit({ ...state, player: { x: nextX, y: nextY } })
    },
    takeDamage(amount) {
      commit(applyDamage(state, amount))
    },
    attackSentinel() {
      if (state.sentinelHealth > 0) {
        commit(applyAttack(state, character.attack))
      }
    },
    defeatSentinel() {
      if (state.status === 'active' && state.objectives.relic && state.sentinelHealth > 0) {
        commit(applyAttack(state, state.sentinelHealth))
      }
    },
    recoverRelic() {
      commit(completeObjective(state, 'relic'))
    },
    reachGate() {
      if (state.objectives.relic && state.objectives.sentinel) {
        commit(completeObjective(state, 'gate'))
      }
    },
  }
}
