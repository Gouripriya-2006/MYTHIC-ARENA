import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { getEquipmentStats } from './systems/equipment.js'
import { getSkillBonuses } from './systems/skillTree.js'
import { canStartPlayerAttack, getPlayerAttackRejectionReason, PLAYER_ATTACK_COST } from './playerCombat.js'

const KEY_ALIASES = new Map([
  [' ', 'space'],
  ['arrowup', 'w'],
  ['arrowleft', 'a'],
  ['arrowdown', 's'],
  ['arrowright', 'd'],
  ['control', 'dodge'],
  ['b', 'block'],
])

export function createThirdPersonController({
  scene,
  canvas,
  camera,
  character,
  progress,
  collides,
  onAttack,
  onAbility,
  onInteract,
  onMessage,
  onTutorialEvent,
}) {
  const keys = new Set()
  let verticalVelocity = 0
  let grounded = true
  let dodgeTimer = 0
  let dodgeCooldown = 0
  let attackMotionTimer = 0
  let positionSaveTimer = 0
  let staminaUpdateTimer = 0
  let staminaDelta = 0
  let blockWasActive = false
  let blocking = false
  let paused = false
  let dodgeRequested = false
  let currentAttackMotion = null
  let wasGrounded = true
  let landingTimer = 0
  let lastStatus = progress.getState().status
  const confirmedTutorialEvents = new Set()
  const movementKeys = new Set(['w', 'a', 's', 'd', 'shift', 'space', 'dodge', 'block'])
  const actionKeys = new Set(['e', 'j', 'k', 'q'])

  const normalizeKey = (key) => KEY_ALIASES.get(key.toLowerCase()) ?? key.toLowerCase()
  const onKeyDown = (event) => {
    if (event.target?.matches('input, textarea, select, [contenteditable="true"]')) return
    if (paused) return
    const key = normalizeKey(event.key)
    if (movementKeys.has(key) || actionKeys.has(key)) event.preventDefault()
    if (!movementKeys.has(key) && !actionKeys.has(key)) return
    const wasDown = keys.has(key)
    keys.add(key)
    if (wasDown || event.repeat) return
    if (key === 'e') interact()
    if (key === 'j') startAttack('light', { instantDefeat: true })
    if (key === 'k') startAttack('heavy')
    if (key === 'dodge') dodgeRequested = true
    if (key === 'q') triggerAbility()
  }
  const onKeyUp = (event) => keys.delete(normalizeKey(event.key))
  const onBlur = () => keys.clear()
  const onVisibilityChange = () => {
    if (document.hidden) keys.clear()
  }
  let cameraDragging = false
  const onCameraPointerDown = (event) => {
    cameraDragging = event.button === 0
  }
  const onCameraPointerMove = (event) => {
    if (cameraDragging && (Math.abs(event.movementX) > 1 || Math.abs(event.movementY) > 1)) {
      confirmTutorialEvent('camera')
    }
  }
  const onCameraPointerUp = () => {
    cameraDragging = false
  }

  function startAttack(type, options = {}) {
    const state = progress.getState()
    if (!canStartPlayerAttack({
      type,
      status: state.status,
      paused,
      stamina: state.stamina,
      cooldownRemaining: attackMotionTimer,
    })) {
      const reason = getPlayerAttackRejectionReason({
        type,
        status: state.status,
        paused,
        stamina: state.stamina,
        cooldownRemaining: attackMotionTimer,
      })
      if (reason) onMessage(reason)
      return false
    }
    progress.dispatch({ type: 'spend-stamina', amount: PLAYER_ATTACK_COST[type] })
    confirmTutorialEvent(type === 'light' ? 'light-attack' : 'heavy-attack')
    attackMotionTimer = type === 'heavy' ? 0.62 : 0.4
    currentAttackMotion = type === 'heavy' ? 'heavy-attack' : 'attack'
    character.setMotion(type === 'heavy' ? 'heavy-attack' : 'attack')
    character.playAction(type === 'heavy' ? 'heavy-attack' : 'attack')
    return onAttack(type, options) !== false
  }

  function interact() {
    if (!paused && progress.getState().status === 'active') return onInteract() !== false
    return false
  }

  function confirmTutorialEvent(event) {
    if (confirmedTutorialEvents.has(event)) return
    if (onTutorialEvent?.(event)) confirmedTutorialEvents.add(event)
  }

  function triggerAbility() {
    if (!paused && progress.getState().status === 'active') return onAbility() !== false
    return false
  }

  function tryDodge(direction) {
    const state = progress.getState()
    if (paused || state.status !== 'active' || dodgeCooldown > 0 || state.stamina < 24) return false
    progress.dispatch({ type: 'spend-stamina', amount: 24 })
    dodgeTimer = 0.34
    dodgeCooldown = 0.8
    confirmTutorialEvent('dodge')
    character.playAction('dodge')
    character.root.metadata = { ...(character.root.metadata ?? {}), invulnerable: true }
    onMessage('Dodge!')
    if (direction.lengthSquared() === 0) direction.copyFromFloats(-Math.cos(camera.alpha), 0, -Math.sin(camera.alpha))
    direction.normalize()
    character.root.metadata.dodgeDirection = direction.clone()
    return true
  }

  window.addEventListener('keydown', onKeyDown)
  window.addEventListener('keyup', onKeyUp)
  window.addEventListener('blur', onBlur)
  document.addEventListener('visibilitychange', onVisibilityChange)
  canvas.addEventListener('pointerdown', onCameraPointerDown)
  canvas.addEventListener('pointermove', onCameraPointerMove)
  canvas.addEventListener('pointerup', onCameraPointerUp)
  canvas.addEventListener('pointercancel', onCameraPointerUp)

  const observer = scene.onBeforeRenderObservable.add(() => {
    const delta = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05)
    if (paused) return
    const player = character.root
    dodgeCooldown = Math.max(0, dodgeCooldown - delta)
    attackMotionTimer = Math.max(0, attackMotionTimer - delta)

    const forward = Number(keys.has('w')) - Number(keys.has('s'))
    const strafe = Number(keys.has('d')) - Number(keys.has('a'))
    const direction = new Vector3(
      -Math.cos(camera.alpha) * forward - Math.sin(camera.alpha) * strafe,
      0,
      -Math.sin(camera.alpha) * forward + Math.cos(camera.alpha) * strafe,
    )
    if (direction.lengthSquared() > 0) direction.normalize()

    if (dodgeRequested && dodgeCooldown === 0) tryDodge(direction.clone())
    dodgeRequested = false
    dodgeTimer = Math.max(0, dodgeTimer - delta)
    if (player.metadata?.invulnerable && dodgeTimer === 0) {
      player.metadata.invulnerable = false
      delete player.metadata.dodgeDirection
    }

    const state = progress.getState()
    if (state.status !== lastStatus) {
      lastStatus = state.status
      if (state.status === 'defeat') character.playAction('death')
      if (state.status === 'victory') character.playAction('victory')
    }
    if (state.status !== 'active') {
      character.setMotion(state.status === 'victory' ? 'victory' : 'death', delta)
      return
    }
    blocking = keys.has('block') && state.stamina > 0
    if (blocking) confirmTutorialEvent('guard')
    if (blocking && !blockWasActive) onMessage('Guarding. Incoming attacks are reduced.')
    blockWasActive = blocking
    const sprinting = keys.has('shift') && direction.lengthSquared() > 0 && state.stamina > 0 && !blocking
    if (sprinting) staminaDelta -= 18 * delta
    else if (blocking) staminaDelta -= 8 * delta
    else if (dodgeTimer === 0 && attackMotionTimer === 0) staminaDelta += 14 * delta
    staminaUpdateTimer += delta
    if (staminaUpdateTimer >= 0.12) {
      if (staminaDelta < 0) progress.dispatch({ type: 'spend-stamina', amount: -staminaDelta })
      else if (staminaDelta > 0) progress.dispatch({ type: 'regenerate-stamina', amount: staminaDelta })
      staminaDelta = 0
      staminaUpdateTimer = 0
    }

    let speed = (sprinting ? 8.3 : 5.2)
      * getEquipmentStats(state.equipment).movementMultiplier
      * (1 + getSkillBonuses(state).movementSpeed)
    if (blocking) speed *= 0.38
    if (dodgeTimer > 0) {
      speed = 13
      direction.copyFrom(player.metadata.dodgeDirection)
    }

    if (direction.lengthSquared() > 0 && state.status === 'active') {
      const previousX = player.position.x
      const previousZ = player.position.z
      const stepX = direction.x * speed * delta
      const stepZ = direction.z * speed * delta
      if (!collides(player.position.x + stepX, player.position.z)) player.position.x += stepX
      if (!collides(player.position.x, player.position.z + stepZ)) player.position.z += stepZ
      if (player.position.x !== previousX || player.position.z !== previousZ) {
        confirmTutorialEvent('move')
        if (sprinting) confirmTutorialEvent('sprint')
      }
      const desiredRotation = Quaternion.RotationYawPitchRoll(Math.atan2(direction.x, direction.z), 0, 0)
      player.rotationQuaternion = Quaternion.Slerp(player.rotationQuaternion, desiredRotation, Math.min(delta * 11, 1))
    }

    if (keys.has('space') && grounded && state.status === 'active') {
      verticalVelocity = 7.3
      grounded = false
      confirmTutorialEvent('jump')
    }
    if (!grounded) {
      verticalVelocity -= 20 * delta
      player.position.y = Math.max(0, player.position.y + verticalVelocity * delta)
      if (player.position.y === 0) {
        grounded = true
        verticalVelocity = 0
        if (!wasGrounded) {
          landingTimer = 0.28
          character.playAction('landing')
        }
      }
    }
    wasGrounded = grounded
    landingTimer = Math.max(0, landingTimer - delta)

    if (attackMotionTimer > 0) character.setMotion(attackMotionTimer < 0.18 ? 'idle' : currentAttackMotion, delta)
    else if (landingTimer > 0) character.setMotion('landing', delta)
    else if (!grounded) character.setMotion('jump', delta)
    else if (blocking) character.setMotion('block', delta)
    else     if (dodgeTimer > 0) character.setMotion('dodge', delta)
    else if (direction.lengthSquared() > 0) character.setMotion(sprinting ? 'sprint' : 'walk', delta)
    else character.setMotion('idle', delta)

    camera.setTarget(Vector3.Lerp(camera.target, player.position.add(new Vector3(0, 1.15, 0)), Math.min(delta * 6, 1)))

    positionSaveTimer += delta
    if (positionSaveTimer >= 3) {
      positionSaveTimer = 0
      progress.dispatch({ type: 'move', position: { x: player.position.x, y: player.position.y, z: player.position.z } })
      progress.save()
    }
  })

  return {
    startAttack,
    canStartAttack(type) {
      const state = progress.getState()
      return canStartPlayerAttack({
        type,
        status: state.status,
        paused,
        stamina: state.stamina,
        cooldownRemaining: attackMotionTimer,
      })
    },
    getAttackRejectionReason(type) {
      const state = progress.getState()
      return getPlayerAttackRejectionReason({
        type,
        status: state.status,
        paused,
        stamina: state.stamina,
        cooldownRemaining: attackMotionTimer,
      })
    },
    isInvulnerable: () => dodgeTimer > 0,
    setVirtualKey(key, pressed) {
      const normalized = normalizeKey(key)
      if (['e', 'j', 'k', 'q'].includes(normalized)) {
        if (!pressed) return false
        if (normalized === 'e') return interact()
        if (normalized === 'j') return startAttack('light')
        if (normalized === 'k') return startAttack('heavy')
        if (normalized === 'q') return triggerAbility()
        return false
      }
      if (pressed) {
        if (keys.has(normalized)) return
        keys.add(normalized)
        if (normalized === 'dodge') dodgeRequested = true
      } else {
        keys.delete(normalized)
      }
    },
    triggerAbility,
    setPaused(value) {
      paused = value
      keys.clear()
      dodgeRequested = false
      return paused
    },
    isPaused: () => paused,
    isBlocking: () => blocking,
    dispose() {
      scene.onBeforeRenderObservable.remove(observer)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      canvas.removeEventListener('pointerdown', onCameraPointerDown)
      canvas.removeEventListener('pointermove', onCameraPointerMove)
      canvas.removeEventListener('pointerup', onCameraPointerUp)
      canvas.removeEventListener('pointercancel', onCameraPointerUp)
      progress.dispatch({ type: 'move', position: { x: character.root.position.x, y: character.root.position.y, z: character.root.position.z } })
      progress.save()
      keys.clear()
    },
  }
}
