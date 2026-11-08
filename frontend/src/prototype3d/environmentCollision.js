export function createBoxCollider(x, z, width, depth, id = 'environment-box') {
  return Object.freeze({
    shape: 'box',
    id,
    x,
    z,
    halfWidth: width / 2,
    halfDepth: depth / 2,
  })
}

export function createRiverCollisionBounds({
  x = 31,
  halfWidth = 7.5,
  worldLimit = 68,
  bridgeStart = 10.5,
  bridgeEnd = 29.5,
} = {}) {
  return [
    createBoxCollider(x, (bridgeEnd + worldLimit) / 2, halfWidth * 2, worldLimit - bridgeEnd, 'river-north-bank'),
    createBoxCollider(x, (-worldLimit + bridgeStart) / 2, halfWidth * 2, worldLimit + bridgeStart, 'river-south-bank'),
  ]
}

export function isWorldPositionWalkable(x, z, {
  worldLimit = 68,
  playerRadius = 0.62,
  circleColliders = [],
  boxColliders = [],
} = {}) {
  if (Math.abs(x) > worldLimit || Math.abs(z) > worldLimit) return false

  const clearOfCircles = circleColliders.every((obstacle) => (
    Math.hypot(x - obstacle.x, z - obstacle.z) >= obstacle.radius + playerRadius
  ))
  if (!clearOfCircles) return false

  return boxColliders.every((box) => {
    const nearestX = Math.max(box.x - box.halfWidth, Math.min(x, box.x + box.halfWidth))
    const nearestZ = Math.max(box.z - box.halfDepth, Math.min(z, box.z + box.halfDepth))
    return Math.hypot(x - nearestX, z - nearestZ) >= playerRadius
  })
}
