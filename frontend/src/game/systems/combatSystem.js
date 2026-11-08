export function applyDamage(state, damage) {
  if (!Number.isFinite(damage) || damage <= 0 || state.status !== 'active') {
    return state
  }

  const health = Math.max(0, state.health - damage)
  return {
    ...state,
    health,
    status: health === 0 ? 'defeat' : state.status,
  }
}

export function applyAttack(state, damage) {
  if (!Number.isFinite(damage) || damage <= 0 || state.status !== 'active') {
    return state
  }

  const sentinelHealth = Math.max(0, state.sentinelHealth - damage)
  return {
    ...state,
    sentinelHealth,
    objectives: {
      ...state.objectives,
      sentinel: sentinelHealth === 0,
    },
  }
}
