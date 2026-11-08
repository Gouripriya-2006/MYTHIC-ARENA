export function inspectInteractionTargets(targets, player, state, {
  playerRadius = 0.62,
  interactionDistance = 3.1,
} = {}) {
  const eligibleTargets = targets
    .filter(({ id }) => id === 'keeper' ? true
      : id === 'relic' ? !state.objectives.relic
        : id === 'cache' ? !state.inventory.some(({ id: itemId }) => itemId === 'ancient-cache')
          : true)
    .map((target) => ({
      ...target,
      centerDistance: Math.hypot(player.x - target.position.x, player.z - target.position.z),
    }))
    .map((target) => ({
      ...target,
      distance: Math.max(0, target.centerDistance - playerRadius - (target.radius ?? 0)),
    }))
  const candidates = eligibleTargets.map((target) => ({
    id: target.id,
    centerDistance: target.centerDistance,
    surfaceDistance: target.distance,
    interactionDistance,
    inRange: target.distance <= interactionDistance,
  }))
  const selected = eligibleTargets
    .filter(({ distance }) => distance <= interactionDistance)
    .sort((a, b) => a.distance - b.distance)[0] ?? null
  return { candidates, selected }
}

export function findNearestInteraction(targets, player, state, options) {
  return inspectInteractionTargets(targets, player, state, options).selected
}
