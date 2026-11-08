import { ArcRotateCamera } from '@babylonjs/core/Cameras/arcRotateCamera.js'
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js'
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { Scene } from '@babylonjs/core/scene.js'
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js'
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js'
import { PointLight } from '@babylonjs/core/Lights/pointLight.js'
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js'
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js'
import { ParticleSystem } from '@babylonjs/core/Particles/particleSystem.js'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js'
import '@babylonjs/core/Meshes/instancedMesh.js'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js'
import { CreateGround } from '@babylonjs/core/Meshes/Builders/groundBuilder.js'
import { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder.js'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js'
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js'
import { createHeroCharacter } from './heroCharacter.js'
import { createEnemyAppearance } from './enemyAppearance.js'
import { createThirdPersonController } from './playerController.js'
import { createEnemyAI, createSentinelAI, updateEnemyAI } from './systems/enemyAi.js'
import { BOSS_ATTACKS, createLostKingdomBoss, updateBossAI } from './systems/bossAi.js'
import { ENEMY_ARCHETYPES, ENEMY_REWARDS } from './systems/enemyArchetypes.js'
import { getEquipmentStats } from './systems/equipment.js'
import { canUseItem } from './systems/inventory.js'
import { getItemDefinition } from './systems/inventoryItems.js'
import { canEnemyDetectPlayer, coordinateEnemyAttacks, getEncounterAttackLimit } from './systems/enemyTactics.js'
import { createBoxCollider, createRiverCollisionBounds, isWorldPositionWalkable } from './environmentCollision.js'
import {
  advanceProjectile,
  hasLineOfSight,
  isWithinAttackArc,
  resolveIncomingAttack,
} from './systems/combatMechanics.js'
import { getSkillBonuses } from './systems/skillTree.js'
import { findNearestInteraction, inspectInteractionTargets } from './systems/interactionDetection.js'
import { NPCS } from './systems/npcs.js'
import { canExecuteArenaVoiceAction } from './voiceActionRules.js'
import {
  calculatePlayerAttackDamage,
  directionToTarget,
  executeInstantDefeat,
  findNearestEnemyTarget,
  getPlayerAttackRange,
} from './playerCombat.js'

const WORLD_LIMIT = 68
const PLAYER_RADIUS = 0.62
const BOSS_PHASE_COLORS = [
  new Color3(0.35, 0.035, 0.08),
  new Color3(0.28, 0.04, 0.48),
  new Color3(0.72, 0.11, 0.015),
]

export function createArenaScene(engine, canvas, progress, hud, onTutorialEvent = () => false, audio = null) {
  const scene = new Scene(engine)
  scene.clearColor = new Color4(0.055, 0.063, 0.11, 1)
  scene.fogMode = Scene.FOGMODE_EXP2
  scene.fogDensity = 0.0044
  scene.fogColor = new Color3(0.16, 0.17, 0.27)
  scene.collisionsEnabled = true
  scene.gravity = new Vector3(0, -0.18, 0)

  const ambient = new HemisphericLight('twilight-ambient', new Vector3(0.15, 1, 0.1), scene)
  ambient.intensity = 0.66
  ambient.diffuse = new Color3(0.71, 0.75, 0.95)
  ambient.groundColor = new Color3(0.12, 0.1, 0.18)
  const keyLight = new DirectionalLight('sanctum-key-light', new Vector3(-0.45, -1, 0.35), scene)
  keyLight.position = new Vector3(38, 58, -42)
  keyLight.intensity = 1.5
  keyLight.diffuse = new Color3(1, 0.79, 0.56)

  const shadows = new ShadowGenerator(1536, keyLight)
  shadows.useBlurExponentialShadowMap = true
  shadows.blurKernel = 18

  const materials = createMaterials(scene)
  const colliders = []
  const environmentBounds = createRiverCollisionBounds({ worldLimit: WORLD_LIMIT })
  createGround(scene, materials)
  createMountains(scene, materials)
  createSanctum(scene, materials, shadows, colliders)
  createForest(scene, materials, shadows, colliders)
  createWorldLandmarks(scene, materials, shadows, colliders, environmentBounds)
  createOuterRuins(scene, materials, shadows, colliders, environmentBounds)
  createEnemyCamps(scene, materials, shadows, colliders, environmentBounds)
  createAtmosphere(scene)

  const hero = progress.getState().hero
  const character = createHeroCharacter(scene, shadows, hero, hud.setModelStatus)
  character.applyEquipment(progress.getState().equipment)
  const practiceDummy = createPracticeDummy(scene, materials)
  character.root.position.set(
    progress.getState().position.x,
    progress.getState().position.y,
    progress.getState().position.z,
  )
  const camera = createCamera(scene, canvas, character.root)
  const relic = createRelic(scene, materials, colliders)
  const keeper = createKeeper(scene, materials, shadows, colliders)
  const townNpcs = Object.fromEntries(Object.values(NPCS)
    .filter(({ position }) => position)
    .map((npc) => [npc.id, createTownNpc(scene, shadows, colliders, npc)]))
  const gate = createGate(scene, materials, shadows, colliders)
  const cache = createHiddenCache(scene, materials, colliders, environmentBounds)
  const sentinel = createSentinelAI()
  const sentinelMesh = createSentinelMesh(scene, materials, shadows)
  const genericEnemies = ENEMY_ARCHETYPES.map((archetype) => {
    const ai = createEnemyAI(archetype)
    const model = createEnemyAppearance(scene, { ...archetype, position: ai.position }, shadows)
    const tell = createAttackTelegraph(model.root, scene, `${archetype.id}-attack-telegraph`, Math.max(2.6, archetype.attackRange * 1.7))
    const instance = { ai, model, archetype, telegraph: tell.mesh, telegraphMaterial: tell.material }
    if (progress.getState().enemies[archetype.id].defeated) {
      ai.defeated = true
      model.root.setEnabled(false)
    }
    return instance
  })
  const boss = createLostKingdomBoss()
  const bossMesh = createBossMesh(scene, materials, shadows)
  const bossArena = createBossArena(scene, materials)
  bossMesh.root.setEnabled(false)
  const projectiles = []
  const enemyProjectiles = []
  const rewardPickups = new Map()
  let abilityCooldownRemaining = 0
  let protectionRemaining = 0
  const savedProgress = progress.getState()
  if (savedProgress.objectives.relic) {
    relic.root.setEnabled(false)
    relic.glow.setEnabled(false)
  }
  if (savedProgress.inventory.some(({ id }) => id === 'ancient-cache')) cache.root.setEnabled(false)
  if (savedProgress.enemies.sentinel.defeated) {
    sentinel.defeated = true
    sentinelMesh.root.setEnabled(false)
  }
  if (savedProgress.enemies.boss.defeated) boss.defeated = true
  if (savedProgress.objectives.sentinel && !savedProgress.enemies.boss.defeated) bossMesh.root.setEnabled(true)
  bossArena.root.setEnabled(savedProgress.objectives.sentinel && !savedProgress.enemies.boss.defeated)
  boss.phase = savedProgress.enemies.boss.health <= savedProgress.enemies.boss.maxHealth * 0.4
    ? 3
    : savedProgress.enemies.boss.health <= savedProgress.enemies.boss.maxHealth * 0.7 ? 2 : 1
  if (savedProgress.objectives.gate) gate.seal.setEnabled(false)
  let controller
  let nearestInteraction = null
  let elapsedTime = 0
  let lastPrompt = ''
  let cinematicFinish = null
  let practiceStepWasActive = false

  const message = (text) => hud.showMessage(text)
  const interactionTargets = [
    { id: 'keeper', label: 'Speak with the Veil Keeper', position: keeper.position, radius: 0.62 },
    ...Object.values(NPCS).filter(({ position }) => position).map((npc) => ({
      id: npc.id,
      label: `Speak with ${npc.name}`,
      position: townNpcs[npc.id].position,
      radius: 0.58,
    })),
    { id: 'relic', label: 'Recover the Sun Relic', position: relic.position, radius: 1.08 },
    { id: 'cache', label: 'Search the hidden cache', position: cache.position, radius: 0.9 },
    { id: 'gate', label: 'Open the ancient gate', position: gate.position },
  ]

  function playCinematic(title, copy, focusPosition, onFinish) {
    cinematicFinish?.()
    controller.setPaused(true)
    const focus = focusPosition instanceof Vector3
      ? focusPosition
      : new Vector3(focusPosition.x, focusPosition.y ?? 0, focusPosition.z)
    const startAlpha = camera.alpha
    const startRadius = camera.radius
    const targetAlpha = Math.atan2(focus.x - character.root.position.x, focus.z - character.root.position.z)
    const originalTarget = character.root.position.add(new Vector3(0, 1.15, 0))
    let elapsed = 0
    let timeout
    let finished = false
    const observer = scene.onBeforeRenderObservable.add(() => {
      const delta = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05)
      elapsed += delta
      const amount = Math.min(elapsed / 1.8, 1)
      camera.alpha = startAlpha + (targetAlpha - startAlpha) * amount
      camera.radius = startRadius + (9 - startRadius) * amount
      camera.setTarget(Vector3.Lerp(originalTarget, focus.add(new Vector3(0, 2, 0)), amount))
    })
    const finish = () => {
      if (finished) return
      finished = true
      clearTimeout(timeout)
      scene.onBeforeRenderObservable.remove(observer)
      camera.setTarget(character.root.position.add(new Vector3(0, 1.15, 0)))
      camera.radius = 13
      controller.setPaused(false)
      hud.hideCinematic()
      cinematicFinish = null
      onFinish?.()
    }
    cinematicFinish = finish
    hud.showCinematic(title, copy, finish)
    timeout = setTimeout(finish, 5200)
  }

  function getActiveEnemies() {
    const state = progress.getState()
    if (state.status !== 'active') return []
    const targets = []
    if (state.objectives.relic) {
      targets.push(...genericEnemies
        .filter(({ ai }) => !state.enemies[ai.id].defeated)
        .map(({ ai, archetype }) => ({ ...state.enemies[ai.id], id: ai.id, name: archetype.name, position: ai.position, radius: archetype.collisionRadius })))
      if (!state.objectives.sentinel && !state.enemies.sentinel.defeated) {
        targets.push({ ...state.enemies.sentinel, id: 'sentinel', name: sentinel.name, position: sentinel.position, radius: 0.8 })
      } else if (state.objectives.sentinel && !state.objectives.boss && !state.enemies.boss.defeated) {
        targets.push({ ...state.enemies.boss, id: 'boss', name: boss.name, position: boss.position, radius: 1.45 })
      }
    }
    if (state.tutorial.status === 'active' && state.tutorial.step === 2 && !practiceDummy.defeated) {
      targets.push({
        id: 'practice-dummy',
        name: 'Training Warden',
        position: practiceDummy.position,
        radius: practiceDummy.radius,
        health: practiceDummy.health,
        maxHealth: practiceDummy.maxHealth,
      })
    }
    return targets
  }

  function findAttackTarget(range) {
    const player = character.root.position
    return getActiveEnemies()
      .filter((target) => Math.hypot(player.x - target.position.x, player.z - target.position.z) <= range)
      .filter((target) => isWithinAttackArc(player, character.root.forward, target.position, range))
      .filter((target) => hasLineOfSight(player, target.position, colliders))
      .sort((a, b) => Math.hypot(player.x - a.position.x, player.z - a.position.z)
        - Math.hypot(player.x - b.position.x, player.z - b.position.z))[0] ?? null
  }

  function findNearestActiveEnemy(targetId) {
    const activeEnemies = getActiveEnemies()
    const candidates = targetId ? activeEnemies.filter((enemy) => enemy.id === targetId) : activeEnemies
    return findNearestEnemyTarget(candidates, character.root.position)
  }

  function createRewardPickup(enemyId, position) {
    if (rewardPickups.has(enemyId)) return rewardPickups.get(enemyId)
    const root = new TransformNode(`${enemyId}-reward-pickup`, scene)
    root.position.set(position.x, 0.62, position.z)
    const halo = CreateTorus(`${enemyId}-reward-halo`, { diameter: 0.9, thickness: 0.09, tessellation: 20 }, scene)
    halo.parent = root
    halo.rotation.x = Math.PI / 2
    halo.material = materials.gold
    halo.isPickable = false
    const shard = CreateSphere(`${enemyId}-reward-shard`, { diameter: 0.42, segments: 8 }, scene)
    shard.parent = root
    shard.position.y = 0.25
    const loot = progress.getState().enemyRewards[enemyId].loot
    shard.material = loot?.itemId === 'health-potion' ? materials.healthPickup
      : loot?.itemId === 'mana-potion' ? materials.manaPickup
        : materials.glow
    shard.isPickable = false
    const pickup = { root, baseY: root.position.y }
    rewardPickups.set(enemyId, pickup)
    return pickup
  }

  function playEnemyDefeatFeedback(root, position) {
    root.setEnabled(true)
    createImpact(scene, materials, position, true)
    const initialScale = root.scaling.clone()
    let elapsed = 0
    const observer = scene.onBeforeRenderObservable.add(() => {
      if (root.isDisposed() || scene.isDisposed) {
        scene.onBeforeRenderObservable.remove(observer)
        return
      }
      elapsed += Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05)
      const remaining = Math.max(0, 1 - elapsed / 0.72)
      const scale = remaining * remaining
      root.scaling.copyFrom(initialScale.scale(scale))
      if (elapsed >= 0.72) {
        root.setEnabled(false)
        scene.onBeforeRenderObservable.remove(observer)
      }
    })
  }

  function completeVictoryIfReady() {
    const state = progress.getState()
    if (state.status !== 'active'
      || !state.objectives.boss
      || !state.enemies.boss.defeated
      || getActiveEnemies().length > 0) return false

    const completed = progress.dispatch({ type: 'open-gate' }, { persist: true })
    if (completed === state) return false
    controller.setPaused(true)
    gate.seal.setEnabled(false)
    audio?.play('victory')
    audio?.playMusic('victory')
    message('The Sun Relic restores the ancient gate. The Lost Kingdom is complete!')
    return true
  }

  function handleEnemyDefeat(enemyId) {
    const generic = genericEnemies.find(({ ai }) => ai.id === enemyId)
    const enemy = enemyId === 'boss' ? boss : enemyId === 'sentinel' ? sentinel : generic?.ai
    const model = enemyId === 'boss' ? bossMesh : enemyId === 'sentinel' ? sentinelMesh : generic?.model
    if (!model) return
    enemy.defeated = true
    playEnemyDefeatFeedback(model.root, enemy.position)
    if (progress.getState().enemyRewards[enemyId].pending) createRewardPickup(enemyId, enemy.position)
    if (enemyId === 'sentinel') {
      audio?.play('enemy-defeat')
      bossMesh.root.setEnabled(true)
      bossArena.root.setEnabled(true)
      audio?.play('boss-intro')
      audio?.playMusic('boss')
      message('The Sentinel falls. A greater presence stirs beyond the sanctum.')
      playCinematic(
        'THE WARDEN AWAKENS',
        'Ravana, Warden of the Veil, rises to defend the last gate. Survive three shifting phases and watch the ground for his attacks.',
        boss.position,
      )
    } else if (enemyId === 'boss') {
      audio?.play('enemy-defeat')
      message('The Warden falls. The ancient gate is yours to open.')
      const victoryCompleted = completeVictoryIfReady()
      if (!victoryCompleted) {
        playCinematic('THE VEIL BREAKS', 'The Sun Relic burns bright. The Lost Kingdom can see dawn again.', gate.position)
      }
    } else {
      audio?.play('enemy-defeat')
      const loot = progress.getState().enemyRewards[enemyId].loot
      message(`${generic.archetype.name} defeated. ${getItemDefinition(loot?.itemId)?.name ?? 'Loot'} and ${ENEMY_REWARDS[enemyId].gold} gold dropped.`)
      completeVictoryIfReady()
    }
  }

  function applyEnemyHit(enemyId, damage, source) {
    if (enemyId === 'practice-dummy') {
      if (practiceDummy.defeated) return false
      practiceDummy.health = Math.max(0, practiceDummy.health - damage)
      practiceDummy.defeated = practiceDummy.health === 0
      practiceDummy.root.setEnabled(!practiceDummy.defeated)
      audio?.play(practiceDummy.defeated ? 'enemy-defeat' : 'enemy-hit')
      createImpact(scene, materials, practiceDummy.position, hero.classId === 'mage')
      message(practiceDummy.defeated
        ? 'Training target defeated. It will return if you revisit this lesson.'
        : `${source} strikes the Training Warden. ${practiceDummy.health} practice health remains.`)
      return true
    }
    const before = progress.getState().enemies[enemyId]
    if (!before || before.defeated) return false
    progress.dispatch({ type: 'damage-enemy', enemyId, amount: damage }, { persist: true })
    const after = progress.getState().enemies[enemyId]
    audio?.play('enemy-hit')
    const enemy = enemyId === 'boss' ? boss : enemyId === 'sentinel' ? sentinel : genericEnemies.find(({ ai }) => ai.id === enemyId)?.ai
    if (after.defeated) handleEnemyDefeat(enemyId)
    else message(`${source} hits ${enemyId === 'boss' ? boss.name : enemyId === 'sentinel' ? sentinel.name : enemy?.name ?? enemyId} for ${damage}.`)
    if (enemy) createImpact(scene, materials, enemy.position, enemyId === 'boss' || enemyId === 'fireMonster')
    return true
  }

  function launchAstralBolt(damage, range = 20, critical = false, target = findAttackTarget(range)) {
    if (!target) {
      message('No clear target for Astral Bolt.')
      return false
    }
    audio?.play('ability')
    const targetPosition = target.position
    const aim = directionToTarget(character.root.position, targetPosition)
    const direction = new Vector3(aim.x, 0, aim.z)
    const start = character.root.position.add(direction.scale(0.85)).add(new Vector3(0, 1.35, 0))
    const mesh = CreateSphere(`astral-bolt-${Date.now()}`, { diameter: 0.34, segments: 10 }, scene)
    mesh.material = materials.glow
    mesh.position.copyFrom(start)
    mesh.isPickable = false
    projectiles.push({
      mesh,
      position: { x: start.x, y: start.y, z: start.z },
      direction: { x: direction.x, z: direction.z },
      speed: 19,
      traveled: 0,
      maxDistance: range,
      damage,
      critical,
    })
    message('Astral Bolt launched.')
    return true
  }

  function updateProjectiles(deltaSeconds) {
    for (let index = projectiles.length - 1; index >= 0; index -= 1) {
      const projectile = projectiles[index]
      const result = advanceProjectile(projectile, deltaSeconds, colliders, getActiveEnemies())
      Object.assign(projectile, result.projectile)
      projectile.mesh.position.set(projectile.position.x, projectile.position.y, projectile.position.z)
      if (result.collision) {
        if (result.collision.type === 'target') {
          applyEnemyHit(result.collision.targetId, projectile.damage, projectile.critical ? 'Critical Astral Bolt' : 'Astral Bolt')
        }
        else createImpact(scene, materials, result.collision.position, true)
        projectile.mesh.dispose()
        projectiles.splice(index, 1)
      } else if (result.finished) {
        projectile.mesh.dispose()
        projectiles.splice(index, 1)
      }
    }
  }

  function updateRewardPickups(deltaSeconds) {
    const state = progress.getState()
    for (const [enemyId, pickup] of rewardPickups) {
      if (!state.enemyRewards[enemyId].pending) {
        pickup.root.dispose()
        rewardPickups.delete(enemyId)
        continue
      }
      const position = pickup.root.position
      position.y = pickup.baseY + Math.sin(elapsedTime * 3.2) * 0.12
      pickup.root.rotation.y += deltaSeconds * 1.8
      if (Math.hypot(character.root.position.x - position.x, character.root.position.z - position.z) <= 1.8) {
        const before = progress.getState()
        const after = progress.dispatch({ type: 'collect-enemy-reward', enemyId }, { persist: true })
        if (after === before) {
          if (!pickup.fullNotified) message('Inventory full. Use or discard an item before collecting this loot.')
          pickup.fullNotified = true
          continue
        }
        const lootName = getItemDefinition(before.enemyRewards[enemyId].loot?.itemId)?.name ?? 'gold'
        pickup.root.dispose()
        rewardPickups.delete(enemyId)
        message(`${getEnemyName(enemyId)} reward collected: ${lootName} and ${ENEMY_REWARDS[enemyId].gold} gold.`)
      }
    }
  }

  function getEnemyName(enemyId) {
    if (enemyId === 'sentinel') return sentinel.name
    if (enemyId === 'boss') return boss.name
    return genericEnemies.find(({ ai }) => ai.id === enemyId)?.archetype.name ?? enemyId
  }

  function updateEnemyHud() {
    const player = character.root.position
    const activeEnemies = getActiveEnemies()
    const target = activeEnemies.find((enemy) => enemy.id === 'boss') ?? activeEnemies
      .map((enemy) => ({
        enemy,
        distance: Math.hypot(player.x - enemy.position.x, player.z - enemy.position.z),
      }))
      .filter(({ enemy, distance }) => distance <= 24 && hasLineOfSight(player, enemy.position, colliders))
      .sort((a, b) => a.distance - b.distance)[0]?.enemy
    if (target?.id === 'boss') {
      const attack = BOSS_ATTACKS[boss.attackPattern]
      const warning = boss.attackPhase === 'telegraph' ? `${attack?.name ?? 'Ravana'} · ${attack?.warning ?? ''}` : null
      hud.setEnemy(target.name, target.health, target.maxHealth, true, boss.phase, warning)
    } else if (target) hud.setEnemy(target.name, target.health, target.maxHealth, true)
    else hud.setEnemy('', 0, 1, false)
  }

  function launchEnemyProjectile(enemy, archetype) {
    const playerPosition = character.root.position
    const dx = playerPosition.x - enemy.position.x
    const dz = playerPosition.z - enemy.position.z
    const distance = Math.hypot(dx, dz)
    if (distance === 0) return
    const direction = { x: dx / distance, z: dz / distance }
    const start = { x: enemy.position.x + direction.x * 0.78, y: 1.35, z: enemy.position.z + direction.z * 0.78 }
    const mesh = archetype.projectile.kind === 'arrow'
      ? CreateCylinder(`${enemy.id}-projectile-${Date.now()}`, { height: 0.84, diameterTop: 0.015, diameterBottom: 0.07, tessellation: 6 }, scene)
      : CreateSphere(`${enemy.id}-projectile-${Date.now()}`, { diameter: archetype.projectile.diameter, segments: 8 }, scene)
    mesh.material = materials[archetype.projectile.material]
    mesh.position.set(start.x, start.y, start.z)
    if (archetype.projectile.kind === 'arrow') {
      mesh.rotation.x = Math.PI / 2
      mesh.rotation.y = Math.atan2(direction.x, direction.z)
    }
    mesh.isPickable = false
    enemyProjectiles.push({
      mesh,
      position: start,
      direction,
      speed: archetype.projectile.speed,
      traveled: 0,
      maxDistance: archetype.projectile.range,
      damage: enemy.damage,
      sourceId: enemy.id,
      sourcePosition: { ...enemy.position },
    })
  }

  function updateEnemyProjectiles(deltaSeconds) {
    const target = { id: 'player', position: character.root.position, radius: PLAYER_RADIUS }
    for (let index = enemyProjectiles.length - 1; index >= 0; index -= 1) {
      const projectile = enemyProjectiles[index]
      const result = advanceProjectile(projectile, deltaSeconds, colliders, [target])
      Object.assign(projectile, result.projectile)
      projectile.mesh.position.set(projectile.position.x, projectile.position.y, projectile.position.z)
      if (result.collision) {
        if (result.collision.type === 'target') applyEnemyProjectileDamage(projectile)
        projectile.mesh.dispose()
        enemyProjectiles.splice(index, 1)
      } else if (result.finished) {
        projectile.mesh.dispose()
        enemyProjectiles.splice(index, 1)
      }
    }
  }

  function applyEnemyProjectileDamage(projectile) {
    const facingAttacker = isWithinAttackArc(
      character.root.position,
      character.root.forward,
      projectile.sourcePosition,
      Infinity,
      Math.PI * 0.42,
    )
    const bonuses = getSkillBonuses(progress.getState())
    const result = resolveIncomingAttack(projectile.damage, {
      invulnerable: controller.isInvulnerable(),
      blocking: controller.isBlocking(),
      facingAttacker,
      blockDamageMultiplier: Math.max(0.08, 0.32 * (1 - bonuses.shieldStrength)),
    })
    if (result.result === 'dodged') message(`You evade ${getEnemyName(projectile.sourceId)}'s projectile.`)
    else {
      const damage = protectedDamage(result.damage)
      progress.dispatch({ type: 'damage-player', amount: damage }, { persist: true })
      message(result.result === 'blocked'
        ? `Guarded ${getEnemyName(projectile.sourceId)}'s projectile. ${damage} damage taken.`
        : `${getEnemyName(projectile.sourceId)}'s projectile hits for ${damage} damage.`)
      if (result.result === 'blocked') performCounterattack(projectile.sourceId, projectile.damage, bonuses)
      createImpact(scene, materials, character.root.position, true)
    }
  }

  function protectedDamage(damage) {
    return protectionRemaining > 0 ? Math.max(1, Math.ceil(damage * 0.75)) : damage
  }

  function performCounterattack(sourceId, incomingDamage, bonuses) {
    if (hero.classId !== 'guardian' || bonuses.counterDamage <= 0) return
    const player = character.root.position
    const target = getActiveEnemies().find((enemy) => enemy.id === sourceId
      && Math.hypot(player.x - enemy.position.x, player.z - enemy.position.z) <= 3.8
      && hasLineOfSight(player, enemy.position, colliders))
    if (target) applyEnemyHit(target.id, Math.max(1, Math.round(incomingDamage * bonuses.counterDamage)), 'Guardian counter')
  }

  function applyEnemyDamage(enemy, baseDamage, attackName, range, halfAngleRadians) {
    const player = character.root.position
    const facing = { x: Math.sin(enemy.facingYaw), z: Math.cos(enemy.facingYaw) }
    if (!isWithinAttackArc(enemy.position, facing, player, range, halfAngleRadians)) return
    if (!hasLineOfSight(enemy.position, player, colliders)) return
    audio?.play('enemy-attack')
    const facingAttacker = isWithinAttackArc(player, character.root.forward, enemy.position, Infinity, Math.PI * 0.42)
    const bonuses = getSkillBonuses(progress.getState())
    const result = resolveIncomingAttack(baseDamage, {
      invulnerable: controller.isInvulnerable(),
      blocking: controller.isBlocking(),
      facingAttacker,
      blockDamageMultiplier: Math.max(0.08, 0.32 * (1 - bonuses.shieldStrength)),
    })
    if (result.result === 'dodged') {
      message(`You evade ${attackName}.`)
      return
    }
    const damage = protectedDamage(result.damage)
    progress.dispatch({ type: 'damage-player', amount: damage }, { persist: true })
    audio?.play('player-hit')
    message(result.result === 'blocked'
      ? `Guarded ${attackName}. ${damage} damage taken.`
      : `${attackName} strikes for ${damage} damage.`)
    if (result.result === 'blocked') performCounterattack(enemy.id, baseDamage, bonuses)
    createImpact(scene, materials, player, false)
  }

  function applyBossAreaDamage(center, damage, attackName, radius) {
    const player = character.root.position
    if (Math.hypot(player.x - center.x, player.z - center.z) > radius) return
    if (!hasLineOfSight(center, player, colliders)) return
    const facingAttacker = isWithinAttackArc(player, character.root.forward, center, Infinity, Math.PI * 0.42)
    const bonuses = getSkillBonuses(progress.getState())
    const result = resolveIncomingAttack(damage, {
      invulnerable: controller.isInvulnerable(),
      blocking: controller.isBlocking(),
      facingAttacker,
      blockDamageMultiplier: Math.max(0.08, 0.32 * (1 - bonuses.shieldStrength)),
    })
    if (result.result === 'dodged') {
      message(`You evade ${attackName}.`)
      return
    }
    const finalDamage = protectedDamage(result.damage)
    progress.dispatch({ type: 'damage-player', amount: finalDamage }, { persist: true })
    audio?.play('player-hit')
    message(result.result === 'blocked'
      ? `Guarded ${attackName}. ${finalDamage} damage taken.`
      : `${attackName} strikes for ${finalDamage} damage.`)
    if (result.result === 'blocked') performCounterattack('boss', damage, bonuses)
    createImpact(scene, materials, player, true)
  }

  function applyAttack(type, { instantDefeat = false, targetId } = {}) {
    const classId = hero.classId
    const rangedMage = classId === 'mage' && type === 'light'
    const state = progress.getState()
    const bonuses = getSkillBonuses(state)
    const weaponDamage = getEquipmentStats(state.equipment).damage
    const critical = Math.random() < bonuses.criticalChance
    const damage = calculatePlayerAttackDamage({
      type,
      classId,
      weaponDamage,
      meleeDamageBonus: bonuses.meleeDamage,
      spellDamageBonus: bonuses.spellDamage,
      heavyDamageBonus: bonuses.heavyDamage,
      critical,
    })
    audio?.play(rangedMage ? 'ability' : type === 'heavy' ? 'player-heavy' : 'player-light')
    if (instantDefeat && type === 'light') {
      const target = findNearestActiveEnemy(targetId)
      if (!target) return false
      return executeInstantDefeat(target, applyEnemyHit)
    }
    if (rangedMage) {
      const range = getPlayerAttackRange(type, classId, bonuses.abilityRange)
      return launchAstralBolt(damage, range, critical, findAttackTarget(range))
    }
    const target = findAttackTarget(getPlayerAttackRange(type, classId))
    if (!target) {
      message('No enemy within striking range.')
      return false
    }
    return applyEnemyHit(target.id, damage, critical ? 'Critical strike' : type === 'heavy' ? 'Heavy strike' : 'Strike')
  }

  function useAbility() {
    const state = progress.getState()
    const bonuses = getSkillBonuses(state)
    if (abilityCooldownRemaining > 0) {
      message(`Class ability ready in ${abilityCooldownRemaining.toFixed(1)} seconds.`)
      return false
    }
    const cost = Math.max(12, (hero.classId === 'mage' ? 34 : hero.classId === 'guardian' ? 26 : 28) - bonuses.abilityCostReduction)
    if (state.stamina < cost) {
      message('Not enough stamina to use your class ability.')
      return false
    }
    if (hero.classId === 'guardian') {
      audio?.play('ability')
      progress.dispatch({ type: 'spend-stamina', amount: cost })
      progress.dispatch({ type: 'heal-player', amount: 28 }, { persist: true })
      protectionRemaining = 3 + bonuses.abilityDuration
      abilityCooldownRemaining = Math.max(1, 5 * (1 - bonuses.cooldownReduction))
      createImpact(scene, materials, character.root.position, true)
      message(`Living Aegis restores your strength and protects you for ${protectionRemaining} seconds.`)
      return true
    }
    const range = (hero.classId === 'mage' ? 24 : 5.2) + bonuses.abilityRange
    const target = findAttackTarget(range)
    if (!target) {
      message('Your ability finds no target.')
      return false
    }
    audio?.play('ability')
    progress.dispatch({ type: 'spend-stamina', amount: cost })
    abilityCooldownRemaining = Math.max(1, 5 * (1 - bonuses.cooldownReduction))
    const damage = Math.round(((hero.classId === 'mage' ? 52 : 42) + getEquipmentStats(state.equipment).damage)
      * (1 + (hero.classId === 'mage' ? bonuses.spellDamage : bonuses.meleeDamage))
      * (1 + bonuses.abilityDamage))
    return applyEnemyHit(target.id, damage, getCharacterAbility(hero.classId))
  }

  function readTargetHealth(target) {
    if (target.id === 'practice-dummy') return practiceDummy.health
    return progress.getState().enemies[target.id]?.health ?? null
  }

  function waitForTargetDamage(target, beforeHealth) {
    return new Promise((resolve) => {
      let elapsed = 0
      let timer
      const finish = (damaged) => {
        clearTimeout(timer)
        scene.onBeforeRenderObservable.remove(observer)
        resolve(damaged)
      }
      const observer = scene.onBeforeRenderObservable.add(() => {
        const health = readTargetHealth(target)
        if (health !== null && health < beforeHealth) return finish(true)
        if (scene.isDisposed) return finish(false)
        elapsed += Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05)
        if (elapsed >= 2.5) finish(false)
      })
      timer = setTimeout(() => finish(false), 3000)
    })
  }

  async function executeVoiceAttack(type) {
    const range = getPlayerAttackRange(type, hero.classId,
      type === 'light' && hero.classId === 'mage' ? getSkillBonuses(progress.getState()).abilityRange : 0)
    const target = type === 'light' ? findNearestActiveEnemy() : findAttackTarget(range)
    if (!target) return {
      ok: false,
      error: type === 'light' ? 'No active enemies found.' : `No valid enemy target within ${range} units.`,
      actionResult: 'Attack not executed.',
    }
    const beforeHealth = readTargetHealth(target)
    if (beforeHealth === null) return { ok: false, error: 'The selected target is no longer available.', actionResult: 'Attack not executed.' }
    if (!controller.startAttack(type, type === 'light' ? { instantDefeat: true, targetId: target.id } : undefined)) {
      return { ok: false, error: controller.getAttackRejectionReason(type) || 'The combat handler rejected the attack.', actionResult: 'Attack not executed.' }
    }
    const afterHealth = readTargetHealth(target)
    if (type === 'light') {
      if (afterHealth === 0) return { ok: true, actionResult: `${target.name}: ${beforeHealth} → 0 HP.` }
      return {
        ok: false,
        error: `${target.name} was not defeated by the combat handler.`,
        actionResult: `${target.name} HP did not reach zero; attack did not succeed.`,
      }
    }
    if (afterHealth !== null && afterHealth < beforeHealth) {
      return { ok: true, actionResult: `${target.name}: ${beforeHealth} → ${afterHealth} HP.` }
    }
    if (await waitForTargetDamage(target, beforeHealth)) {
      return { ok: true, actionResult: `${target.name}: ${beforeHealth} → ${readTargetHealth(target)} HP.` }
    }
    return {
      ok: false,
      error: `${target.name} took no damage. Check facing, range, and line of sight.`,
      actionResult: `${target.name} HP remained ${beforeHealth}; attack did not succeed.`,
    }
  }

  function interact() {
    const playerPosition = character.root.getAbsolutePosition()
    const keeperPosition = keeper.root.getAbsolutePosition()
    const { candidates, selected } = inspectInteractionTargets(
      interactionTargets,
      playerPosition,
      progress.getState(),
      { playerRadius: PLAYER_RADIUS },
    )
    nearestInteraction = selected
    console.info('[Interaction diagnostics]', JSON.stringify({
      playerWorldPosition: { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z },
      keeperWorldPosition: { x: keeperPosition.x, y: keeperPosition.y, z: keeperPosition.z },
      keeperRegistered: interactionTargets.some((target) => (
        target.id === 'keeper' && target.position === keeper.position
      )),
      keeperRootName: keeper.root.name,
      playerRadius: PLAYER_RADIUS,
      keeperRadius: interactionTargets.find(({ id }) => id === 'keeper')?.radius ?? 0,
      interactionRadius: 3.1,
      candidates,
      selectedTarget: selected?.id ?? null,
    }))
    if (!nearestInteraction) {
      message('Move closer to an object or character to interact.')
      return false
    }
    const state = progress.getState()
    switch (nearestInteraction.id) {
      case 'keeper':
        {
        audio?.play('interaction')
        const firstMeeting = !state.objectives.briefing
        if (firstMeeting) {
          progress.dispatch({
            type: 'accept-quest',
            questId: 'main-keepers-charge',
            npcId: 'keeper',
          }, { persist: true })
          onTutorialEvent('quest-accepted')
        } else {
          progress.dispatch({ type: 'briefing' }, { persist: true })
        }
        const dialogue = state.objectives.briefing
          ? 'The Keeper shares the realm’s available charges. Review and accept them in your journal.'
          : 'Keeper: “I am the last voice of this kingdom. Find the Sun Relic, silence its guardian, and open the eastern gate.”'
        message(dialogue)
        if (firstMeeting) {
          playCinematic(
            'THE VEIL KEEPER',
            'The Keeper speaks of a stolen Sun Relic and the sentinel bound to protect it.',
            keeper.position,
            () => {
              controller.setPaused(true)
              hud.openDialogue(NPCS.keeper)
            },
          )
        } else {
          controller.setPaused(true)
          hud.openDialogue(NPCS.keeper)
        }
        return true
        break
        }
      case 'relic':
        if (!state.objectives.briefing) {
          message('The keeper may know what this relic is. Speak with her first.')
          return false
        }
        if (progress.dispatch({ type: 'collect-relic' }, { persist: true }) === state) {
          message('Inventory full. Make room before recovering the Sun Relic.')
          return false
        }
        relic.root.setEnabled(false)
        relic.glow.setEnabled(false)
        audio?.play('relic')
        message('The Sun Relic is yours. The Veil Sentinel awakens!')
        playCinematic('THE SUN RELIC', 'Light returns to the altar. Something ancient stirs among the ruins.', relic.position)
        return true
      case 'cache':
        if (progress.dispatch({ type: 'collect-cache' }, { persist: true }) === state) {
          message('Inventory full. Make room before searching the cache.')
          return false
        }
        cache.root.setEnabled(false)
        audio?.play('relic')
        message('Hidden treasure found: 50 gold and a Sanctum Cache.')
        return true
      case 'gate':
        if (!state.objectives.relic || !state.objectives.sentinel || !state.objectives.boss) {
          message('The ancient gate is sealed. Recover the relic and defeat the Sentinel and its Warden.')
          return false
        }
        if (progress.dispatch({ type: 'open-gate' }, { persist: true }) === state) {
          message('Make room in your inventory to claim the remaining loot before opening the gate.')
          return false
        }
        gate.seal.setEnabled(false)
        audio?.play('victory')
        audio?.playMusic('victory')
        message('The Sun Relic restores the gate. The Lost Kingdom is complete!')
        return true
      default:
        if (NPCS[nearestInteraction.id] && townNpcs[nearestInteraction.id]) {
          audio?.play('interaction')
          controller.setPaused(true)
          hud.openDialogue(NPCS[nearestInteraction.id])
          return true
        }
        return false
    }
  }

  controller = createThirdPersonController({
    scene,
    canvas,
    camera,
    character,
    progress,
    collides: (x, z) => !isWalkable(x, z, colliders, environmentBounds)
      || (!progress.getState().enemies.sentinel.defeated
        && Math.hypot(x - sentinel.position.x, z - sentinel.position.z) < 1.35)
      || (!progress.getState().enemies.boss.defeated
        && Math.hypot(x - boss.position.x, z - boss.position.z) < 2.4)
      || genericEnemies.some(({ ai }) => !progress.getState().enemies[ai.id].defeated
        && Math.hypot(x - ai.position.x, z - ai.position.z) < ai.collisionRadius),
    onAttack: applyAttack,
    onAbility: useAbility,
    onInteract: interact,
    onMessage: message,
    onTutorialEvent,
  })

  for (const enemyId of ['sentinel', 'boss', ...ENEMY_ARCHETYPES.map(({ id }) => id)]) {
    if (!progress.getState().enemyRewards[enemyId].pending) continue
    const position = enemyId === 'boss'
      ? boss.position
      : enemyId === 'sentinel'
        ? sentinel.position
        : genericEnemies.find(({ ai }) => ai.id === enemyId).ai.position
    createRewardPickup(enemyId, position)
  }

  completeVictoryIfReady()

  if (progress.getState().status === 'active' && !progress.getState().objectives.briefing) {
    setTimeout(() => {
      if (!scene.isDisposed && progress.getState().status === 'active') {
        playCinematic('THE LOST KINGDOM', 'A kingdom sleeps beneath the Shattered Veil. Find the keeper, recover the Sun Relic, and face what guards the ancient gate.', keeper.position)
      }
    }, 350)
  }

  const sceneObserver = scene.onBeforeRenderObservable.add(() => {
    const delta = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05)
    if (controller.isPaused()) return
    abilityCooldownRemaining = Math.max(0, abilityCooldownRemaining - delta)
    protectionRemaining = Math.max(0, protectionRemaining - delta)
    elapsedTime += delta
    updateDayNight(scene, ambient, keyLight, elapsedTime)
    updateProjectiles(delta)
    updateEnemyProjectiles(delta)
    updateRewardPickups(delta)
    if (controller.isPaused()) return
    nearestInteraction = findNearestInteraction(interactionTargets, character.root.position, progress.getState(), {
      playerRadius: PLAYER_RADIUS,
    })
    const prompt = nearestInteraction ? `E · ${nearestInteraction.label}` : ''
    if (prompt !== lastPrompt) {
      lastPrompt = prompt
      hud.setPrompt(prompt || null)
    }

    const state = progress.getState()
    const practiceStepActive = state.tutorial.status === 'active' && state.tutorial.step === 2
    if (practiceStepActive && !practiceStepWasActive) {
      if (practiceDummy.defeated) {
        practiceDummy.health = practiceDummy.maxHealth
        practiceDummy.defeated = false
      }
      practiceDummy.position.copyFrom(character.root.position.add(character.root.forward.scale(2.6)))
    }
    practiceDummy.root.setEnabled(practiceStepActive && !practiceDummy.defeated)
    practiceStepWasActive = practiceStepActive
    if (Math.hypot(character.root.position.x - 31, character.root.position.z - 20) <= 4.5) {
      progress.dispatch({ type: 'quest-location', locationId: 'bridge' }, { persist: true })
    }
    if (state.status !== 'active' || !state.objectives.relic) return
    const playerPosition = character.root.position
    const combatants = [
      ...(!state.objectives.sentinel && !state.enemies.sentinel.defeated ? [sentinel] : []),
      ...genericEnemies.map(({ ai }) => ai).filter((ai) => !state.enemies[ai.id].defeated),
    ]
    const visibility = new Map(combatants.map((enemy) => [
      enemy.id,
      canEnemyDetectPlayer(enemy, playerPosition, colliders),
    ]))
    const permittedAttackers = coordinateEnemyAttacks(combatants, playerPosition, {
      maxConcurrent: getEncounterAttackLimit(state),
      canSee: (enemy) => visibility.get(enemy.id),
    })
    const neighborSnapshots = combatants.map((enemy) => ({
      id: enemy.id,
      defeated: enemy.defeated,
      collisionRadius: enemy.collisionRadius ?? 0.8,
      position: { ...enemy.position },
    }))
    if (!state.objectives.sentinel) {
      const nextEnemy = updateEnemyAI(sentinel, playerPosition, delta, {
        canSeePlayer: visibility.get(sentinel.id),
        attackAllowed: permittedAttackers.has(sentinel.id),
        neighbors: neighborSnapshots,
      })
      Object.assign(sentinel, nextEnemy)
      sentinelMesh.root.position.copyFromFloats(sentinel.position.x, sentinel.position.y, sentinel.position.z)
      sentinelMesh.root.rotation.y = sentinel.facingYaw
      sentinelMesh.pulse.material.emissiveColor.set(0.55 + Math.sin(elapsedTime * 5) * 0.2, 0.04, 0.12)
      updateAttackTell(sentinelMesh, sentinel.attackPhase, sentinel.attackPhaseTime)
      if (sentinel.attackDamage > 0) {
        applyEnemyDamage(sentinel, sentinel.attackDamage, 'The Sentinel', sentinel.attackRange + 0.35, Math.PI * 0.39)
      }
      if (controller.isPaused() || progress.getState().status !== 'active') return
    }

    for (const instance of genericEnemies) {
      const { ai, archetype } = instance
      if (progress.getState().enemies[ai.id].defeated) continue
      Object.assign(ai, updateEnemyAI(ai, playerPosition, delta, {
        canSeePlayer: visibility.get(ai.id),
        attackAllowed: permittedAttackers.has(ai.id),
        neighbors: neighborSnapshots,
      }))
      instance.model.root.position.copyFromFloats(ai.position.x, ai.position.y, ai.position.z)
      instance.model.root.rotation.y = ai.facingYaw
      updateAttackTell(instance, ai.attackPhase, ai.attackPhaseTime)
      if (ai.attackDamage > 0) {
        if (ai.attackStyle === 'ranged') launchEnemyProjectile(ai, archetype)
        else applyEnemyDamage(ai, ai.attackDamage, ai.name, ai.attackRange + 0.3, Math.PI * 0.39)
      }
      if (controller.isPaused() || progress.getState().status !== 'active') return
    }

    if (state.objectives.sentinel && !state.objectives.boss) {
      const bossHealth = state.enemies.boss
      const playerPosition = character.root.position
      const canSeePlayer = Math.hypot(playerPosition.x - boss.position.x, playerPosition.z - boss.position.z) <= boss.aggroRange
        && hasLineOfSight(boss.position, playerPosition, colliders)
      const nextBoss = updateBossAI(boss, playerPosition, bossHealth.health / bossHealth.maxHealth, delta, { canSeePlayer })
      if (nextBoss.phaseChanged) {
        audio?.play('boss-phase')
        audio?.playMusic('boss')
        message(nextBoss.phase === 2
          ? 'PHASE II · THE VEIL UNRAVELS'
          : 'PHASE III · RAVANA UNLEASHES FINAL FURY')
      }
      if (nextBoss.attackStarted) {
        audio?.play('boss-warning')
        const attack = BOSS_ATTACKS[nextBoss.attackPattern]
        if (attack) message(`${attack.name}! ${attack.warning}`)
      }
      Object.assign(boss, nextBoss)
      bossMesh.root.position.copyFromFloats(boss.position.x, boss.position.y, boss.position.z)
      bossMesh.root.rotation.y = boss.facingYaw ?? 0
      bossMesh.root.scaling.setAll(1 + Math.sin(elapsedTime * 2.4) * 0.018)
      bossMesh.core.material.emissiveColor.set(0.5 + boss.phase * 0.1, 0.03, 0.09)
      bossMesh.auraMaterial.emissiveColor.copyFrom(BOSS_PHASE_COLORS[boss.phase - 1])
      bossArena.material.emissiveColor.copyFrom(BOSS_PHASE_COLORS[boss.phase - 1])
      updateBossTelegraph(bossMesh, boss)
      if (boss.attackDamage > 0) {
        const attack = BOSS_ATTACKS[boss.attackPattern]
        const center = attack?.kind === 'targeted'
          ? boss.attackTarget ?? playerPosition
          : attack?.kind === 'dash'
            ? boss.dashDestination ?? boss.position
            : boss.position
        if (attack?.kind === 'melee') {
          applyEnemyDamage(boss, attack.damage, attack.name, attack.range, Math.PI * 0.36)
        } else if (attack) {
          applyBossAreaDamage(center, attack.damage, attack.name, attack.radius)
        }
      }
    }
    if (controller.isPaused() || progress.getState().status !== 'active') return
    updateEnemyHud()

  })

  return {
    scene,
    character,
    controller,
    executeVoiceAttack,
    ready: character.ready,
    canExecuteVoiceAction(intent, state = progress.getState()) {
      const bonuses = getSkillBonuses(state)
      return canExecuteArenaVoiceAction(intent, state, {
        paused: controller.isPaused(),
        classId: hero.classId,
        findNearestInteraction() {
          nearestInteraction = findNearestInteraction(interactionTargets, character.root.position, state, {
            playerRadius: PLAYER_RADIUS,
          })
          return nearestInteraction
        },
        findAttackTarget,
        findNearestActiveEnemy,
        canStartAttack: (type) => controller.canStartAttack(type),
        abilityRangeBonus: bonuses.abilityRange,
        abilityCooldownRemaining,
        abilityCost: Math.max(12, (hero.classId === 'mage' ? 34 : hero.classId === 'guardian' ? 26 : 28)
          - bonuses.abilityCostReduction),
        abilityRange: (hero.classId === 'mage' ? 24 : 5.2) + bonuses.abilityRange,
        canUseItem,
      })
    },
    getVoiceActionRejection(intent, state = progress.getState()) {
      if (state?.status !== 'active') return 'The game is not in an active state.'
      if (controller.isPaused()) return 'Close the current game panel before attacking.'
      if (!['light_attack', 'heavy_attack'].includes(intent.action)) return null
      const type = intent.action === 'light_attack' ? 'light' : 'heavy'
      if (intent.action === 'light_attack' && !findNearestActiveEnemy()) return 'No active enemies found.'
      const readiness = controller.getAttackRejectionReason(type)
      if (readiness) return readiness
      if (intent.action === 'light_attack') return null
      const range = getPlayerAttackRange(type, hero.classId,
        type === 'light' && hero.classId === 'mage' ? getSkillBonuses(state).abilityRange : 0)
      if (!findAttackTarget(range)) {
        return `No enemy with a clear path in front of you is within ${range} units.`
      }
      return null
    },
    dispose() {
      cinematicFinish?.()
      controller.dispose()
      character.dispose()
      scene.onBeforeRenderObservable.remove(sceneObserver)
      camera.detachControl()
      scene.dispose()
    },
    skipCinematic() {
      cinematicFinish?.()
    },
  }
}

export function createMaterials(scene) {
  const material = (name, color, roughness = 0.9, emissive = Color3.Black()) => {
    const result = new StandardMaterial(name, scene)
    result.diffuseColor = color
    result.emissiveColor = emissive
    result.specularColor = new Color3(0.16, 0.15, 0.18)
    result.specularPower = Math.max(12, (1 - roughness) * 128)
    return result
  }

  return {
    ground: material('moss-dark-earth', new Color3(0.13, 0.16, 0.17)),
    path: material('worn-sanctum-stone', new Color3(0.3, 0.28, 0.3)),
    stone: material('weathered-lilac-stone', new Color3(0.28, 0.26, 0.34)),
    stoneLight: material('sunlit-stone-edges', new Color3(0.42, 0.35, 0.32)),
    gold: material('aged-temple-gold', new Color3(0.58, 0.38, 0.13), 0.48),
    mountain: material('mountain-slate', new Color3(0.15, 0.15, 0.23)),
    trunk: material('ancient-tree-bark', new Color3(0.2, 0.13, 0.1)),
    leaves: material('moonlit-jade', new Color3(0.1, 0.21, 0.2)),
    leavesAlt: material('deep-jade', new Color3(0.11, 0.17, 0.21)),
    cloth: material('wayfarer-indigo-cloth', new Color3(0.16, 0.24, 0.47)),
    campCloth: material('weathered-camp-cloth', new Color3(0.3, 0.23, 0.18)),
    armor: material('wayfarer-bronze-armor', new Color3(0.55, 0.31, 0.13), 0.42),
    bossArmor: material('warden-obsidian-armor', new Color3(0.075, 0.055, 0.095), 0.24),
    bossTrim: material('warden-ember-alloy', new Color3(0.56, 0.11, 0.16), 0.35, new Color3(0.4, 0.03, 0.06)),
    darkProjectile: material('dark-archer-void-arrow', new Color3(0.24, 0.12, 0.34), 0.3, new Color3(0.2, 0.045, 0.34)),
    fireProjectile: material('fire-monster-lava-shot', new Color3(0.88, 0.23, 0.035), 0.24, new Color3(0.95, 0.17, 0.025)),
    skin: material('wayfarer-warm-skin', new Color3(0.57, 0.36, 0.27), 0.72),
    hair: material('wayfarer-dark-hair', new Color3(0.09, 0.075, 0.09)),
    glow: material('sanctum-ember-light', new Color3(0.16, 0.09, 0.04), 0.2, new Color3(0.95, 0.38, 0.08)),
    healthPickup: material('health-potion-drop', new Color3(0.76, 0.12, 0.16), 0.25, new Color3(0.65, 0.04, 0.06)),
    manaPickup: material('mana-potion-drop', new Color3(0.15, 0.42, 0.8), 0.25, new Color3(0.06, 0.22, 0.72)),
    water: material('river-of-stars', new Color3(0.08, 0.17, 0.27), 0.15, new Color3(0.025, 0.06, 0.11)),
    waterfall: material('moonlit-waterfall', new Color3(0.26, 0.52, 0.69), 0.18, new Color3(0.1, 0.2, 0.3)),
    waterFoam: material('waterfall-foam', new Color3(0.52, 0.69, 0.7), 0.2, new Color3(0.12, 0.2, 0.23)),
    cave: material('cave-mouth-shadow', new Color3(0.025, 0.025, 0.045), 1),
  }
}

function createGround(scene, materials) {
  const ground = CreateGround('arena-floor', { width: 180, height: 180, subdivisions: 80 }, scene)
  ground.material = materials.ground
  ground.receiveShadows = true

  const path = CreateGround('processional-way', { width: 9, height: 48 }, scene)
  path.position.set(0, 0.025, 27)
  path.material = materials.path
  path.receiveShadows = true

  for (let z = 4; z < 50; z += 5) {
    const inlay = CreateBox(`path-inlay-${z}`, { width: 7.8, height: 0.045, depth: 0.09 }, scene)
    inlay.position.set(0, 0.06, z)
    inlay.material = materials.gold
  }
}

function createMountains(scene, materials) {
  for (let i = 0; i < 19; i += 1) {
    const angle = (i / 19) * Math.PI * 2
    const distance = 79 + (i % 3) * 5
    const height = 22 + ((i * 13) % 18)
    const mountain = CreateCylinder(`ridge-spire-${i}`, {
      height,
      diameterTop: 1 + (i % 3),
      diameterBottom: 21 + (i % 4) * 7,
      tessellation: 5 + (i % 3),
    }, scene)
    mountain.position.set(Math.cos(angle) * distance, height * 0.42 - 1, Math.sin(angle) * distance)
    mountain.rotation.y = angle
    mountain.scaling.x = 0.8 + (i % 4) * 0.13
    mountain.material = i % 3 ? materials.mountain : materials.stone
  }
}

export function createSanctum(scene, materials, shadows, colliders) {
  const sanctum = new TransformNode('sunken-sanctum', scene)
  sanctum.position.set(0, 0, 32)

  for (const side of [-1, 1]) {
    for (let i = 0; i < 3; i += 1) {
      const x = side * (5.8 + i * 4.7)
      const column = CreateCylinder(`sanctum-column-${side}-${i}`, {
        height: 7.5 - i * 0.7,
        diameterTop: 1.15,
        diameterBottom: 1.5,
        tessellation: 12,
      }, scene)
      column.position.set(x, (7.5 - i * 0.7) / 2, i === 0 ? 0 : (i - 1) * 1.6)
      column.parent = sanctum
      column.material = materials.stoneLight
      shadows.addShadowCaster(column)
      colliders.push({ x, z: 32 + column.position.z, radius: 1.05 })

      const capital = CreateBox(`column-crown-${side}-${i}`, { width: 2, height: 0.48, depth: 1.9 }, scene)
      capital.position.set(x, 6.8 - i * 0.7, column.position.z)
      capital.parent = sanctum
      capital.material = materials.gold
    }
  }

  const lintel = CreateBox('sanctum-lintel', { width: 17, height: 1.7, depth: 2.2 }, scene)
  lintel.position.set(0, 7.4, 0)
  lintel.parent = sanctum
  lintel.material = materials.stone
  shadows.addShadowCaster(lintel)

  const altar = CreateBox('sanctum-altar', { width: 5, height: 1.25, depth: 3 }, scene)
  altar.position.set(0, 0.63, -8)
  altar.parent = sanctum
  altar.material = materials.stone
  colliders.push({ x: 0, z: 24, radius: 2.3 })

  const halo = CreateTorus('sunken-sun-emblem', { diameter: 4.8, thickness: 0.16, tessellation: 40 }, scene)
  halo.position.set(0, 4.9, -1.35)
  halo.parent = sanctum
  halo.material = materials.gold

  for (const side of [-1, 1]) {
    const brazier = CreateCylinder(`sanctum-brazier-${side}`, {
      height: 1.4,
      diameterTop: 0.5,
      diameterBottom: 0.85,
      tessellation: 10,
    }, scene)
    brazier.position.set(side * 3.1, 0.7, 27)
    brazier.material = materials.stoneLight
    const flame = new PointLight(`sanctum-firelight-${side}`, new Vector3(side * 3.1, 1.7, 27), scene)
    flame.diffuse = new Color3(1, 0.35, 0.08)
    flame.intensity = 2.1
    flame.range = 12
    const ember = CreateSphere(`sanctum-ember-${side}`, { diameter: 0.45, segments: 8 }, scene)
    ember.position.copyFrom(flame.position)
    ember.material = materials.glow
  }
}

export function createForest(scene, materials, shadows, colliders) {
  const originalTreeSpots = [
    [-13, 1], [15, 4], [-21, 12], [22, 16], [-15, 22], [18, 28],
    [-28, 34], [29, 38], [-37, 5], [38, 11], [-42, 25], [43, 30],
    [-50, 44], [51, 49], [-32, 54], [35, 58], [-8, 63], [9, 67],
    [-55, -12], [55, -18], [-40, -30], [41, -38], [-24, -45], [27, -51],
  ]
  const addedTreeSpots = [
    [-25, -9], [27, -8], [-46, -14], [48, -11], [-32, 2], [46, 3],
    [-46, 17], [54, 22], [-55, 34], [59, 43], [-44, 55], [56, 58],
    [-29, 65], [24, 66], [-60, -40], [55, -55],
    [-58, -2], [-46, -4], [-34, -18], [-56, -28], [-44, -38], [-31, -49],
    [-54, -58], [-36, -64], [-18, -57], [44, -35], [56, -37], [62, -18],
    [48, -4], [59, 4], [56, 16], [63, 29], [64, 63], [-61, 5], [-62, -50], [58, -61],
  ]
  const treeSpots = [...originalTreeSpots, ...addedTreeSpots]
  const trunkSource = CreateCylinder('forest-instanced-trunk-source', {
    height: 1,
    diameterTop: 0.35,
    diameterBottom: 0.78,
    tessellation: 7,
  }, scene)
  trunkSource.position.set(120, -100, 120)
  trunkSource.material = materials.trunk
  const crownSources = [materials.leaves, materials.leavesAlt].map((material, index) => {
    const source = CreateSphere(`forest-instanced-crown-source-${index}`, { diameter: 1, segments: 7 }, scene)
    source.position.set(120, -100, 120)
    source.material = material
    return source
  })
  const shrubSource = CreatePolyhedron('forest-instanced-shrub-source', { type: 1, size: 1 }, scene)
  shrubSource.position.set(120, -100, 120)
  shrubSource.material = materials.leavesAlt

  treeSpots.forEach(([x, z], index) => {
    const safeDistance = index >= originalTreeSpots.length ? 6 : 3.5
    if (isNearProtectedArea(x, z, safeDistance)) return
    const trunkHeight = 3.5 + (index % 4) * 0.55
    const trunk = trunkSource.createInstance(`sacred-tree-trunk-${index}`)
    trunk.position.set(x, trunkHeight / 2, z)
    trunk.rotation.z = ((index % 3) - 1) * 0.08
    trunk.scaling.y = trunkHeight

    for (let tier = 0; tier < 3; tier += 1) {
      const crown = crownSources[(index + tier) % crownSources.length].createInstance(`sacred-tree-crown-${index}-${tier}`)
      const diameter = 3.2 - tier * 0.52
      crown.position.set(x, trunkHeight + tier * 0.86, z)
      crown.scaling.set(diameter, diameter * 0.8, diameter)
      if (tier === 0 && index % 4 === 0) shadows.addShadowCaster(crown)
    }

    colliders.push({ x, z, radius: 1.05 })

    for (let tuft = 0; tuft < 2; tuft += 1) {
      const angle = index * 2.399 + tuft * Math.PI
      const shrubX = x + Math.cos(angle) * 2.4
      const shrubZ = z + Math.sin(angle) * 2.4
      if (isNearProtectedArea(shrubX, shrubZ, 4.6)) continue
      const shrub = shrubSource.createInstance(`forest-underbrush-${index}-${tuft}`)
      shrub.position.set(shrubX, 0.34, shrubZ)
      shrub.scaling.set(0.5 + (index % 3) * 0.08, 0.52 + (tuft * 0.08), 0.48 + (index % 2) * 0.1)
      shrub.rotation.y = angle
    }
  })

  for (let i = 0; i < 20; i += 1) {
    const angle = i * 2.399
    const distance = 26 + (i % 5) * 5
    const rockX = Math.cos(angle) * distance
    const rockZ = Math.sin(angle) * distance + 12
    if (Math.hypot(rockX, rockZ + 7) < 22) continue

    const rock = CreatePolyhedron(`fallen-ruin-${i}`, { type: 1, size: 0.7 + (i % 3) * 0.2 }, scene)
    rock.position.set(rockX, 0.32, rockZ)
    rock.rotation.set(i * 0.18, angle, i * 0.23)
    rock.scaling.y = 0.6
    rock.material = i % 3 ? materials.stone : materials.stoneLight
    colliders.push({ x: rock.position.x, z: rock.position.z, radius: 0.75 })
    if (i < 9) shadows.addShadowCaster(rock)
  }
}

export function createOuterRuins(scene, materials, shadows, colliders, environmentBounds) {
  const sites = [
    { id: 'western-archive-ruin', x: -38, z: 31, opening: 1 },
    { id: 'eastern-watch-ruin', x: 47, z: 32, opening: -1 },
  ]
  for (const site of sites) {
    addRuinWall(scene, materials, shadows, colliders, environmentBounds, site.id, site.x, site.z - 4.2, 9, 0.8, 3.2)
    addRuinWall(scene, materials, shadows, colliders, environmentBounds, `${site.id}-west-wing`, site.x - 4.1, site.z + 0.1, 0.8, 7.2, 2.45)
    addRuinWall(scene, materials, shadows, colliders, environmentBounds, `${site.id}-east-wing`, site.x + 4.1, site.z + 1.7, 0.8, 4.4, 1.9)

    for (const side of [-1, 1]) {
      const columnHeight = 2.8 + (side > 0 ? 0.65 : 0)
      const column = CreateCylinder(`${site.id}-broken-column-${side}`, {
        height: columnHeight,
        diameterTop: 0.52,
        diameterBottom: 0.82,
        tessellation: 7,
      }, scene)
      column.position.set(site.x + side * 4.1, columnHeight / 2, site.z + 4)
      column.material = materials.stoneLight
      shadows.addShadowCaster(column)
      colliders.push({ x: column.position.x, z: column.position.z, radius: 0.62 })
    }

    const brokenLintel = CreateBox(`${site.id}-fallen-lintel`, { width: 4.4, height: 0.58, depth: 0.82 }, scene)
    brokenLintel.position.set(site.x + site.opening * 3.0, 1.2, site.z + 4.2)
    brokenLintel.rotation.z = site.opening * 0.08
    brokenLintel.material = materials.stone
    shadows.addShadowCaster(brokenLintel)
    environmentBounds.push(createBoxCollider(brokenLintel.position.x, brokenLintel.position.z, 4.4, 0.82, `${site.id}-fallen-lintel`))

    for (let rubble = 0; rubble < 5; rubble += 1) {
      const stone = CreatePolyhedron(`${site.id}-rubble-${rubble}`, { type: 1, size: 0.45 + (rubble % 3) * 0.18 }, scene)
      stone.position.set(site.x + (rubble - 2) * 1.35, 0.23, site.z + 5.3 + (rubble % 2) * 0.7)
      stone.rotation.set(rubble * 0.2, rubble * 0.7, rubble * 0.11)
      stone.scaling.y = 0.55
      stone.material = rubble % 2 ? materials.stone : materials.stoneLight
      if (rubble % 2 === 0) shadows.addShadowCaster(stone)
      colliders.push({ x: stone.position.x, z: stone.position.z, radius: 0.42 })
    }
  }
}

function addRuinWall(scene, materials, shadows, colliders, environmentBounds, name, x, z, width, depth, height) {
  const wall = CreateBox(name, { width, height, depth }, scene)
  wall.position.set(x, height / 2, z)
  wall.material = materials.stone
  shadows.addShadowCaster(wall)
  environmentBounds.push(createBoxCollider(x, z, width, depth, name))
  colliders.push({ x, z, radius: Math.max(width, depth) / 2 })
  return wall
}

export function createEnemyCamps(scene, materials, shadows, colliders, environmentBounds) {
  const camps = [
    { id: 'goblin', x: -15, z: 14, style: 'raider' },
    { id: 'dark-archer', x: 21, z: 30, style: 'scout' },
    { id: 'shadow-beast', x: -25, z: 44, style: 'wild' },
    { id: 'fire-monster', x: 25, z: 51, style: 'ashen' },
    { id: 'elite-guardian', x: -31, z: 30, style: 'watch' },
  ]

  for (const camp of camps) {
    const cloth = camp.style === 'ashen' ? materials.bossTrim : materials.campCloth
    if (camp.style === 'wild') {
      for (let bone = 0; bone < 4; bone += 1) {
        const rib = CreateCylinder(`${camp.id}-den-rib-${bone}`, { height: 1.45 + (bone % 2) * 0.35, diameterTop: 0.07, diameterBottom: 0.16, tessellation: 5 }, scene)
        const angle = (bone / 4) * Math.PI + Math.PI / 4
        rib.position.set(camp.x + Math.cos(angle) * 0.65, 0.66, camp.z + Math.sin(angle) * 0.65)
        rib.rotation.z = Math.cos(angle) * 0.55
        rib.rotation.x = Math.sin(angle) * 0.55
        rib.material = materials.stoneLight
      }
      environmentBounds.push(createBoxCollider(camp.x, camp.z, 1.8, 1.5, `${camp.id}-bone-den`))
    } else if (camp.style === 'ashen') {
      const vent = CreatePolyhedron(`${camp.id}-cinder-altar`, { type: 1, size: 0.85 }, scene)
      vent.position.set(camp.x, 0.42, camp.z)
      vent.material = materials.bossArmor
      vent.scaling.y = 0.68
      shadows.addShadowCaster(vent)
      environmentBounds.push(createBoxCollider(camp.x, camp.z, 1.6, 1.4, `${camp.id}-cinder-altar`))
    } else {
      for (const side of [-1, 1]) {
        const tentPanel = CreateBox(`${camp.id}-camp-hide-${side}`, { width: 2.3, height: 0.12, depth: 2.2 }, scene)
        tentPanel.position.set(camp.x + side * 0.42, 0.92, camp.z)
        tentPanel.rotation.z = -side * 0.65
        tentPanel.material = cloth
        shadows.addShadowCaster(tentPanel)
      }
      environmentBounds.push(createBoxCollider(camp.x, camp.z, 2.8, 2.5, `${camp.id}-camp-hide`))
    }

    const ridge = CreateCylinder(`${camp.id}-camp-ridge`, { height: 2.5, diameterTop: 0.12, diameterBottom: 0.15, tessellation: 6 }, scene)
    ridge.position.set(camp.x, 1.2, camp.z)
    ridge.rotation.x = Math.PI / 2
    ridge.material = materials.trunk

    const crate = CreateBox(`${camp.id}-camp-supply-crate`, { width: 0.85, height: 0.72, depth: 0.75 }, scene)
    crate.position.set(camp.x + 2.2, 0.36, camp.z + 0.8)
    crate.rotation.y = camp.x * 0.03
    crate.material = materials.trunk
    environmentBounds.push(createBoxCollider(crate.position.x, crate.position.z, 0.9, 0.8, `${camp.id}-camp-supply-crate`))

    for (let stoneIndex = 0; stoneIndex < 6; stoneIndex += 1) {
      const angle = (stoneIndex / 6) * Math.PI * 2
      const stone = CreatePolyhedron(`${camp.id}-fire-ring-${stoneIndex}`, { type: 1, size: 0.22 + (stoneIndex % 2) * 0.05 }, scene)
      stone.position.set(camp.x + Math.cos(angle) * 1.05, 0.16, camp.z + Math.sin(angle) * 1.05)
      stone.material = materials.stoneLight
      colliders.push({ x: stone.position.x, z: stone.position.z, radius: 0.24 })
    }

    const coldFire = CreateSphere(`${camp.id}-campfire-ember`, { diameter: 0.28, segments: 6 }, scene)
    coldFire.position.set(camp.x, 0.24, camp.z)
    coldFire.material = camp.style === 'ashen' ? materials.glow : materials.cave
    if (camp.style === 'ashen') {
      const scorch = CreateCylinder(`${camp.id}-scorched-ground`, { height: 0.05, diameterTop: 1.8, diameterBottom: 1.8, tessellation: 8 }, scene)
      scorch.position.set(camp.x, 0.035, camp.z)
      scorch.material = materials.campCloth
    }

    const marker = CreateBox(`${camp.id}-camp-marker`, { width: 0.16, height: 1.6, depth: 0.16 }, scene)
    marker.position.set(camp.x - 2, 0.8, camp.z - 1.8)
    marker.material = camp.style === 'watch' ? materials.gold : materials.armor
    colliders.push({ x: marker.position.x, z: marker.position.z, radius: 0.18 })
  }
}

export function createWorldLandmarks(scene, materials, shadows, colliders, environmentBounds) {
  const water = CreateGround('mythic-river', { width: 15, height: 165, subdivisions: 12 }, scene)
  water.position.set(31, 0.035, 0)
  water.material = materials.water
  water.receiveShadows = true

  const fallsRunoff = CreateGround('waterfall-runoff-stream', { width: 24, height: 4.2, subdivisions: 4 }, scene)
  fallsRunoff.position.set(43, 0.045, 48)
  fallsRunoff.material = materials.water
  const plungePool = CreateGround('waterfall-plunge-pool', { width: 12, height: 8, subdivisions: 6 }, scene)
  plungePool.position.set(50, 0.05, 48)
  plungePool.material = materials.water

  const waterfall = CreateBox('distant-waterfall', { width: 8, height: 23, depth: 0.18 }, scene)
  waterfall.position.set(50, 11.5, 48)
  waterfall.material = materials.waterfall
  for (let stream = -1; stream <= 1; stream += 1) {
    const ribbon = CreateBox(`waterfall-flow-ribbon-${stream}`, { width: 0.72, height: 16.5, depth: 0.06 }, scene)
    ribbon.position.set(50 + stream * 2.15, 10.5 + Math.abs(stream) * 0.35, 47.84)
    ribbon.material = materials.waterFoam
    ribbon.isPickable = false
  }
  const foam = CreateBox('waterfall-foot-foam', { width: 9.2, height: 0.1, depth: 0.38 }, scene)
  foam.position.set(50, 0.12, 48)
  foam.material = materials.waterFoam
  const poolRipple = CreateTorus('waterfall-pool-ripple', { diameter: 3.3, thickness: 0.055, tessellation: 20 }, scene)
  poolRipple.position.set(50, 0.13, 50.4)
  poolRipple.rotation.x = Math.PI / 2
  poolRipple.material = materials.waterFoam

  const cliff = CreateBox('waterfall-cliff-face', { width: 1.8, height: 18, depth: 12 }, scene)
  cliff.position.set(55, 8, 48)
  cliff.material = materials.mountain
  shadows.addShadowCaster(cliff)
  environmentBounds.push(createBoxCollider(55, 48, 1.8, 12, 'waterfall-cliff-face'))

  for (let i = 0; i < 7; i += 1) {
    const bankRock = CreatePolyhedron(`waterfall-bank-rock-${i}`, { type: 1, size: 0.65 + (i % 3) * 0.16 }, scene)
    const side = i % 2 ? -1 : 1
    bankRock.position.set(50 + side * (5.2 + (i % 3) * 0.55), 0.42, 44 + Math.floor(i / 2) * 2.3)
    bankRock.scaling.y = 0.7
    bankRock.material = i % 2 ? materials.stone : materials.stoneLight
    if (i % 2 === 0) shadows.addShadowCaster(bankRock)
    colliders.push({ x: bankRock.position.x, z: bankRock.position.z, radius: 0.65 })
  }

  // The center span stays continuous so the existing bridge crossing remains traversable.
  const bridgeDeck = CreateBox('stone-bridge-deck', { width: 5.4, height: 0.16, depth: 19 }, scene)
  bridgeDeck.position.set(31, 0.08, 20)
  bridgeDeck.material = materials.stoneLight
  bridgeDeck.receiveShadows = true
  shadows.addShadowCaster(bridgeDeck)
  for (const side of [-1, 1]) {
    for (const endZ of [12.3, 27.7]) {
      if ((side === 1 && endZ === 12.3) || (side === -1 && endZ === 27.7)) {
        const brokenShoulder = CreateBox(`bridge-broken-shoulder-${side}-${endZ}`, { width: 1.65, height: 0.2, depth: 4.2 }, scene)
        brokenShoulder.position.set(31 + side * 3.5, 0.08, endZ)
        brokenShoulder.rotation.y = side * 0.035
        brokenShoulder.material = materials.stone
        shadows.addShadowCaster(brokenShoulder)
        environmentBounds.push(createBoxCollider(brokenShoulder.position.x, brokenShoulder.position.z, 1.65, 4.2, brokenShoulder.name))
      }
    }
  }
  for (const side of [-1, 1]) {
    for (const segment of [-1, 0, 1]) {
      if ((side === 1 && segment === 0) || (side === -1 && segment === 1)) continue
      const rail = CreateBox(`bridge-parapet-${side}-${segment}`, { width: 0.4, height: 1.15, depth: 5.2 }, scene)
      const z = 20 + segment * 6.6
      rail.position.set(31 + side * 4.1, 0.72, z)
      rail.material = materials.stone
      shadows.addShadowCaster(rail)
      colliders.push({ x: 31 + side * 4.1, z, radius: 0.48 })
    }
  }
  for (let z = 12; z <= 28; z += 4) {
    const slab = CreateBox(`bridge-paving-${z}`, { width: 5.1, height: 0.045, depth: 0.12 }, scene)
    slab.position.set(31, 0.17, z)
    slab.material = materials.gold
  }

  const cave = CreateCylinder('moon-cave-mouth', { height: 7, diameterTop: 7.8, diameterBottom: 10, tessellation: 12 }, scene)
  cave.position.set(-49, 3.2, 45)
  cave.rotation.z = Math.PI / 2
  cave.material = materials.mountain
  const caveDark = CreateSphere('moon-cave-shadow', { diameter: 5.2, segments: 12 }, scene)
  caveDark.position.set(-44, 2.05, 45)
  caveDark.scaling.x = 0.28
  caveDark.material = materials.cave
  const caveMark = CreateTorus('cave-sun-mark', { diameter: 3.5, thickness: 0.12, tessellation: 32 }, scene)
  caveMark.position.set(-43.8, 2.5, 45)
  caveMark.rotation.y = Math.PI / 2
  caveMark.material = materials.gold
  shadows.addShadowCaster(cave)
  for (const side of [-1, 1]) {
    const marker = CreatePolyhedron(`moon-cave-entry-marker-${side}`, { type: 1, size: 0.62 }, scene)
    marker.position.set(-48, 0.68, 45 + side * 5.4)
    marker.scaling.set(0.82, 1.5, 0.82)
    marker.material = materials.stoneLight
    shadows.addShadowCaster(marker)
    colliders.push({ x: marker.position.x, z: marker.position.z, radius: 0.58 })
    const rune = CreateBox(`moon-cave-rune-${side}`, { width: 0.1, height: 0.72, depth: 0.08 }, scene)
    rune.position.set(-47.38, 1.0, 45 + side * 5.4)
    rune.material = materials.gold
  }
}

export function createRelic(scene, materials, colliders) {
  const root = new TransformNode('sun-relic-interactable', scene)
  root.position.set(0, 0, 9)
  const plinth = CreateBox('sun-relic-plinth', { width: 2, height: 0.7, depth: 2 }, scene)
  plinth.parent = root
  plinth.position.y = 0.35
  plinth.material = materials.stoneLight
  const ring = CreateTorus('sun-relic-halo', { diameter: 1.9, thickness: 0.11, tessellation: 32 }, scene)
  ring.parent = root
  ring.position.y = 1.65
  ring.material = materials.gold
  const core = CreateSphere('sun-relic-core', { diameter: 0.55, segments: 16 }, scene)
  core.parent = root
  core.position.y = 1.6
  core.material = materials.glow
  const glow = new PointLight('sun-relic-glow', new Vector3(0, 1.6, 9), scene)
  glow.diffuse = new Color3(1, 0.57, 0.2)
  glow.intensity = 0.8
  glow.range = 8
  colliders.push({ x: root.position.x, z: root.position.z, radius: 1.08 })
  return { root, position: root.position, glow }
}

export function createKeeper(scene, materials, shadows, colliders) {
  const root = new TransformNode('veil-keeper-npc', scene)
  root.position.set(-4.4, 0, -4.5)
  const body = CreateCylinder('veil-keeper-statue', { height: 2.1, diameterTop: 0.7, diameterBottom: 1.1, tessellation: 10 }, scene)
  body.parent = root
  body.position.y = 1.05
  body.material = materials.stoneLight
  const head = CreateSphere('veil-keeper-head', { diameter: 0.65, segments: 10 }, scene)
  head.parent = root
  head.position.y = 2.3
  head.material = materials.stone
  const halo = CreateTorus('veil-keeper-halo', { diameter: 1.6, thickness: 0.1, tessellation: 24 }, scene)
  halo.parent = root
  halo.position.y = 2.45
  halo.material = materials.gold
  root.getChildMeshes().forEach((mesh) => {
    mesh.isPickable = false
    shadows.addShadowCaster(mesh)
  })
  colliders.push({ x: root.position.x, z: root.position.z, radius: 0.62 })
  return { root, position: root.position }
}

function createTownNpc(scene, shadows, colliders, npc) {
  const root = new TransformNode(`${npc.id}-npc`, scene)
  root.position.set(npc.position.x, 0, npc.position.z)
  const robeMaterial = new StandardMaterial(`${npc.id}-robe-material`, scene)
  robeMaterial.diffuseColor = Color3.FromHexString(npc.appearance.robe)
  const accentMaterial = new StandardMaterial(`${npc.id}-accent-material`, scene)
  accentMaterial.diffuseColor = Color3.FromHexString(npc.appearance.accent)
  const skinMaterial = new StandardMaterial(`${npc.id}-skin-material`, scene)
  skinMaterial.diffuseColor = Color3.FromHexString(npc.appearance.skin)

  const body = CreateCylinder(`${npc.id}-robe`, {
    height: 1.55,
    diameterTop: 0.66,
    diameterBottom: npc.appearance.style === 'scout' ? 0.95 : 1.05,
    tessellation: 8,
  }, scene)
  body.parent = root
  body.position.y = 0.88
  body.material = robeMaterial

  const head = CreateSphere(`${npc.id}-face`, { diameter: 0.57, segments: 8 }, scene)
  head.parent = root
  head.position.y = 1.9
  head.material = skinMaterial

  const headwear = npc.appearance.style === 'herbalist'
    ? CreateCylinder(`${npc.id}-hood`, { height: 0.35, diameterTop: 0.12, diameterBottom: 0.74, tessellation: 8 }, scene)
    : CreateSphere(`${npc.id}-hair`, { diameter: 0.64, segments: 8 }, scene)
  headwear.parent = root
  headwear.position.y = 2.12
  headwear.material = accentMaterial

  const sash = CreateBox(`${npc.id}-sash`, { width: 0.78, height: 0.16, depth: 0.12 }, scene)
  sash.parent = root
  sash.position.set(0, 0.75, -0.42)
  sash.material = accentMaterial

  if (npc.appearance.style === 'smith') {
    const hammerHandle = CreateCylinder(`${npc.id}-hammer-handle`, { height: 0.9, diameter: 0.09, tessellation: 6 }, scene)
    hammerHandle.parent = root
    hammerHandle.position.set(0.58, 1.05, 0.12)
    hammerHandle.rotation.z = -0.45
    hammerHandle.material = accentMaterial
    const hammerHead = CreateBox(`${npc.id}-hammer-head`, { width: 0.4, height: 0.22, depth: 0.24 }, scene)
    hammerHead.parent = root
    hammerHead.position.set(0.78, 1.47, 0.12)
    hammerHead.material = materialsForTownNpc(scene, npc, 'metal')
  } else if (npc.appearance.style === 'herbalist') {
    const satchel = CreateBox(`${npc.id}-satchel`, { width: 0.45, height: 0.5, depth: 0.32 }, scene)
    satchel.parent = root
    satchel.position.set(-0.56, 1.05, 0.08)
    satchel.rotation.z = -0.18
    satchel.material = accentMaterial
    const vial = CreateCylinder(`${npc.id}-vial`, { height: 0.42, diameter: 0.17, tessellation: 6 }, scene)
    vial.parent = root
    vial.position.set(0.55, 1.25, 0.05)
    vial.material = materialsForTownNpc(scene, npc, 'vial')
  } else {
    const bow = CreateTorus(`${npc.id}-bow`, { diameter: 0.85, thickness: 0.08, tessellation: 12 }, scene)
    bow.parent = root
    bow.position.set(-0.58, 1.2, 0.08)
    bow.rotation.z = Math.PI / 2
    bow.material = accentMaterial
  }

  root.getChildMeshes().forEach((mesh) => {
    mesh.isPickable = false
    shadows.addShadowCaster(mesh)
  })
  colliders.push({ x: root.position.x, z: root.position.z, radius: 0.58 })
  return { root, position: root.position }
}

function materialsForTownNpc(scene, npc, kind) {
  const material = new StandardMaterial(`${npc.id}-${kind}-material`, scene)
  material.diffuseColor = Color3.FromHexString(kind === 'vial' ? '#82c7d0' : '#9daab2')
  return material
}

export function createGate(scene, materials, shadows, colliders) {
  const root = new TransformNode('sealed-kingdom-gate', scene)
  root.position.set(0, 0, 52)
  for (const side of [-1, 1]) {
    const pillar = CreateBox(`gate-pillar-${side}`, { width: 2, height: 9, depth: 2.2 }, scene)
    pillar.parent = root
    pillar.position.set(side * 6.5, 4.5, 0)
    pillar.material = materials.stoneLight
    shadows.addShadowCaster(pillar)
    colliders.push({ x: side * 6.5, z: 52, radius: 1.25 })

    const flame = CreateSphere(`gate-lantern-${side}`, { diameter: 0.55, segments: 8 }, scene)
    flame.parent = root
    flame.position.set(side * 6.5, 8.7, 0)
    flame.material = materials.glow
  }
  const lintel = CreateBox('gate-lintel', { width: 15, height: 1.5, depth: 2.5 }, scene)
  lintel.parent = root
  lintel.position.y = 9
  lintel.material = materials.gold
  const seal = CreateTorus('gate-seal', { diameter: 3.6, thickness: 0.2, tessellation: 32 }, scene)
  seal.parent = root
  seal.position.y = 5.5
  seal.material = materials.glow
  return { root, position: root.position, seal }
}

export function createHiddenCache(scene, materials, colliders, environmentBounds) {
  const root = new TransformNode('hidden-sanctum-cache', scene)
  root.position.set(21, 0, 14)
  const base = CreateBox('hidden-cache-stone-base', { width: 1.8, height: 0.22, depth: 1.35 }, scene)
  base.parent = root
  base.position.y = 0.12
  base.material = materials.stone
  const chest = CreateBox('hidden-cache-chest', { width: 1.3, height: 0.8, depth: 0.8 }, scene)
  chest.parent = root
  chest.position.y = 0.45
  chest.material = materials.gold
  const lid = CreateBox('hidden-cache-lid', { width: 1.38, height: 0.26, depth: 0.86 }, scene)
  lid.parent = root
  lid.position.y = 0.98
  lid.material = materials.stoneLight
  const clasp = CreateBox('hidden-cache-sun-clasp', { width: 0.16, height: 0.3, depth: 0.08 }, scene)
  clasp.parent = root
  clasp.position.set(0, 0.62, 0.44)
  clasp.material = materials.gold

  for (const side of [-1, 1]) {
    const brokenPillar = CreateCylinder(`hidden-cache-ruin-pillar-${side}`, {
      height: 2.4 - (side > 0 ? 0.4 : 0),
      diameterTop: 0.36,
      diameterBottom: 0.62,
      tessellation: 7,
    }, scene)
    brokenPillar.position.set(21 + side * 2.65, 0.8, 14 - side * 0.25)
    brokenPillar.rotation.z = side * 0.09
    brokenPillar.material = materials.stoneLight
    colliders.push({ x: brokenPillar.position.x, z: brokenPillar.position.z, radius: 0.48 })
  }
  environmentBounds.push(createBoxCollider(21, 14, 1.55, 1.1, 'hidden-cache-chest'))
  return { root, position: root.position }
}

function createSentinelMesh(scene, materials, shadows) {
  const root = new TransformNode('veil-sentinel-enemy', scene)
  root.position.set(0, 0, 24)
  const armor = CreateCylinder('sentinel-armored-body', { height: 1.75, diameterTop: 0.75, diameterBottom: 1.1, tessellation: 8 }, scene)
  armor.parent = root
  armor.position.y = 1.05
  armor.material = materials.armor
  const head = CreateSphere('sentinel-helm', { diameter: 0.72, segments: 8 }, scene)
  head.parent = root
  head.position.y = 2.2
  head.material = materials.stoneLight
  const crest = CreateTorus('sentinel-crest', { diameter: 1, thickness: 0.13, tessellation: 12 }, scene)
  crest.parent = root
  crest.position.y = 2.42
  crest.material = materials.gold
  const pulse = CreateSphere('sentinel-veil-heart', { diameter: 0.38, segments: 8 }, scene)
  pulse.parent = root
  pulse.position.set(0, 1.25, -0.5)
  pulse.material = materials.glow
  const tell = createAttackTelegraph(root, scene, 'sentinel-attack-telegraph', 3.2)
  root.getChildMeshes().forEach((mesh) => {
    mesh.isPickable = false
    shadows.addShadowCaster(mesh)
  })
  return { root, pulse, telegraph: tell.mesh, telegraphMaterial: tell.material }
}

function createPracticeDummy(scene, materials) {
  const root = new TransformNode('tutorial-practice-warden', scene)
  root.position.set(0, 0, -2.8)
  const body = CreateCylinder('tutorial-practice-warden-body', {
    height: 1.55,
    diameterTop: 0.72,
    diameterBottom: 0.92,
    tessellation: 8,
  }, scene)
  body.parent = root
  body.position.y = 0.95
  body.material = materials.armor
  const head = CreateSphere('tutorial-practice-warden-head', { diameter: 0.62, segments: 8 }, scene)
  head.parent = root
  head.position.y = 1.95
  head.material = materials.stoneLight
  const crest = CreateTorus('tutorial-practice-warden-crest', { diameter: 0.98, thickness: 0.1, tessellation: 14 }, scene)
  crest.parent = root
  crest.position.y = 2.2
  crest.material = materials.gold
  const blade = CreateBox('tutorial-practice-warden-blade', { width: 0.16, height: 1.65, depth: 0.12 }, scene)
  blade.parent = root
  blade.position.set(0.68, 0.9, 0)
  blade.material = materials.stoneLight
  root.getChildMeshes().forEach((mesh) => {
    mesh.isPickable = false
  })
  root.setEnabled(false)
  return {
    root,
    position: root.position,
    radius: 0.72,
    health: 120,
    maxHealth: 120,
    defeated: false,
  }
}

function createBossMesh(scene, materials, shadows) {
  const root = new TransformNode('ravana-veil-warden-boss', scene)
  root.position.set(0, 0, 40)
  root.scaling.setAll(1.75)
  const armor = CreateCylinder('warden-black-iron-cuirass', { height: 2.15, diameterTop: 1.05, diameterBottom: 1.55, tessellation: 10 }, scene)
  armor.parent = root
  armor.position.y = 1.35
  armor.material = materials.bossArmor
  const shoulders = CreateBox('warden-spiked-mantle', { width: 2.9, height: 0.5, depth: 1.25 }, scene)
  shoulders.parent = root
  shoulders.position.set(0, 2.2, 0)
  shoulders.material = materials.bossTrim
  const helm = CreateSphere('warden-crowned-helm', { diameter: 0.95, segments: 12 }, scene)
  helm.parent = root
  helm.position.y = 2.85
  helm.material = materials.bossArmor
  const crown = CreateTorus('warden-crown-of-embers', { diameter: 1.4, thickness: 0.13, tessellation: 20 }, scene)
  crown.parent = root
  crown.position.y = 3.2
  crown.rotation.x = Math.PI / 2
  crown.material = materials.bossTrim
  const core = CreateSphere('warden-veil-core', { diameter: 0.68, segments: 12 }, scene)
  core.parent = root
  core.position.set(0, 1.55, -0.75)
  core.material = materials.glow
  const aura = CreateTorus('warden-phase-aura', { diameter: 2.5, thickness: 0.11, tessellation: 24 }, scene)
  aura.parent = root
  aura.position.y = 0.1
  aura.rotation.x = Math.PI / 2
  const auraMaterial = new StandardMaterial('warden-phase-aura-material', scene)
  auraMaterial.diffuseColor = BOSS_PHASE_COLORS[0]
  auraMaterial.emissiveColor = BOSS_PHASE_COLORS[0]
  auraMaterial.alpha = 0.68
  aura.material = auraMaterial
  const blade = CreateBox('warden-greatblade', { width: 0.25, height: 2.8, depth: 0.13 }, scene)
  blade.parent = root
  blade.position.set(1.15, 1.1, 0)
  blade.rotation.z = -0.18
  blade.material = materials.bossTrim
  const tell = createAttackTelegraph(root, scene, 'warden-attack-telegraph', 4.1)
  root.getChildMeshes().forEach((mesh) => {
    mesh.isPickable = false
    shadows.addShadowCaster(mesh)
  })
  aura.isPickable = false
  return { root, core, auraMaterial, telegraph: tell.mesh, telegraphMaterial: tell.material }
}

function createBossArena(scene, materials) {
  const root = new TransformNode('ravana-veil-arena-details', scene)
  root.position.set(0, 0, 40)
  const ring = CreateTorus('warden-arena-rune-ring', { diameter: 23, thickness: 0.13, tessellation: 48 }, scene)
  ring.parent = root
  ring.position.y = 0.075
  ring.rotation.x = Math.PI / 2
  ring.isPickable = false
  const material = new StandardMaterial('warden-arena-rune-material', scene)
  material.diffuseColor = BOSS_PHASE_COLORS[0]
  material.emissiveColor = BOSS_PHASE_COLORS[0]
  material.alpha = 0.38
  ring.material = material

  for (let index = 0; index < 8; index += 1) {
    const angle = index * Math.PI / 4
    const shard = CreatePolyhedron(`warden-arena-shard-${index}`, { type: 1, size: 0.58 }, scene)
    shard.parent = root
    shard.position.set(Math.cos(angle) * 11.6, 0.36, Math.sin(angle) * 11.6)
    shard.rotation.set(0.12 + (index % 2) * 0.08, angle, 0.22 * (index % 3 - 1))
    shard.scaling.set(0.9 + (index % 3) * 0.12, 0.7 + (index % 2) * 0.2, 0.8)
    shard.material = index % 2 ? materials.bossTrim : materials.stone
    shard.isPickable = false
  }
  root.setEnabled(false)
  return { root, material }
}

function updateBossTelegraph(mesh, boss) {
  const attack = BOSS_ATTACKS[boss.attackPattern]
  updateAttackTell(mesh, boss.attackPhase, boss.attackPhaseTime)
  if (!attack || !mesh.telegraph.isEnabled()) return

  const target = attack.kind === 'targeted'
    ? boss.attackTarget
    : attack.kind === 'dash'
      ? boss.dashDestination
      : boss.position
  const dx = (target?.x ?? boss.position.x) - boss.position.x
  const dz = (target?.z ?? boss.position.z) - boss.position.z
  const cosine = Math.cos(boss.facingYaw ?? 0)
  const sine = Math.sin(boss.facingYaw ?? 0)
  mesh.telegraph.position.set(dx * cosine - dz * sine, 0.08, dx * sine + dz * cosine)
  const scale = attack.radius / 2.05
  mesh.telegraph.scaling.set(scale, 1, scale)
  const color = attack.kind === 'targeted' ? new Color3(1, 0.32, 0.025) : new Color3(0.88, 0.06, 0.08)
  mesh.telegraphMaterial.emissiveColor.copyFrom(color)
}

function createAttackTelegraph(root, scene, name, diameter) {
  const mesh = CreateTorus(name, { diameter, thickness: 0.1, tessellation: 32 }, scene)
  mesh.parent = root
  mesh.position.y = 0.08
  mesh.rotation.x = Math.PI / 2
  mesh.isPickable = false
  const material = new StandardMaterial(`${name}-material`, scene)
  material.diffuseColor = new Color3(0.9, 0.19, 0.035)
  material.emissiveColor = new Color3(0.75, 0.08, 0.015)
  material.alpha = 0.8
  mesh.material = material
  mesh.setEnabled(false)
  return { mesh, material }
}

function updateAttackTell(enemyMesh, phase, phaseTime = 0) {
  const visible = phase === 'telegraph' || phase === 'active'
  enemyMesh.telegraph.setEnabled(visible)
  if (!visible) return
  const active = phase === 'active'
  enemyMesh.telegraphMaterial.emissiveColor.set(active ? 1 : 0.75, active ? 0.015 : 0.08, active ? 0.015 : 0.015)
  enemyMesh.telegraphMaterial.alpha = active ? 1 : 0.65 + Math.min(phaseTime, 0.4) * 0.65
  const pulse = active ? 1.05 : 0.92 + Math.min(phaseTime, 0.4) * 0.3
  enemyMesh.telegraph.scaling.set(pulse, 1, pulse)
}

function createImpact(scene, materials, position, arcane) {
  const impact = CreateSphere(`combat-impact-${Math.random().toString(36).slice(2)}`, { diameter: arcane ? 0.72 : 0.48, segments: 8 }, scene)
  impact.position.set(position.x, position.y + 1.35, position.z)
  impact.material = arcane ? materials.glow : materials.gold
  impact.isPickable = false
  let age = 0
  const observer = scene.onBeforeRenderObservable.add(() => {
    const delta = Math.min(scene.getEngine().getDeltaTime() / 1000, 0.05)
    age += delta
    impact.scaling.scaleInPlace(1 + delta * 4)
    if (age >= 0.18) {
      scene.onBeforeRenderObservable.remove(observer)
      impact.dispose()
    }
  })
}

function getCharacterAbility(classId) {
  return { warrior: 'Sunforged strike', mage: 'Astral burst', guardian: 'Verdant resilience' }[classId]
}

function updateDayNight(scene, ambient, keyLight, elapsedTime) {
  const phase = elapsedTime / 100
  const daylight = (Math.sin(phase - Math.PI / 2) + 1) / 2
  keyLight.intensity = 0.48 + daylight * 1.15
  keyLight.direction.set(Math.sin(phase) * 0.65, -0.55 - daylight * 0.45, Math.cos(phase) * 0.65).normalize()
  keyLight.diffuse = Color3.Lerp(new Color3(0.37, 0.48, 0.9), new Color3(1, 0.79, 0.56), daylight)
  ambient.intensity = 0.3 + daylight * 0.48
  scene.fogColor = Color3.Lerp(new Color3(0.085, 0.095, 0.2), new Color3(0.19, 0.19, 0.27), daylight)
  scene.fogDensity = 0.0037 + (1 - daylight) * 0.001
}

function createCamera(scene, canvas, player) {
  const camera = new ArcRotateCamera(
    'wayfarer-follow-camera',
    -Math.PI / 2,
    1.08,
    13,
    player.position.add(new Vector3(0, 1.1, 0)),
    scene,
  )
  camera.lowerRadiusLimit = 5
  camera.upperRadiusLimit = 25
  camera.lowerBetaLimit = 0.38
  camera.upperBetaLimit = 1.42
  camera.angularSensibilityX = 850
  camera.angularSensibilityY = 850
  camera.wheelDeltaPercentage = 0.01
  camera.panningSensibility = 0
  camera.inertia = 0.84
  camera.attachControl(canvas, true)
  return camera
}

function createAtmosphere(scene) {
  const texture = new DynamicTexture('glowing-ash-texture', { width: 32, height: 32 }, scene, false)
  const context = texture.getContext()
  const gradient = context.createRadialGradient(16, 16, 1, 16, 16, 15)
  gradient.addColorStop(0, 'rgba(255,218,156,1)')
  gradient.addColorStop(0.25, 'rgba(255,171,89,.75)')
  gradient.addColorStop(1, 'rgba(255,145,72,0)')
  context.fillStyle = gradient
  context.fillRect(0, 0, 32, 32)
  texture.update()

  const motes = new ParticleSystem('drifting-embers', 160, scene)
  motes.particleTexture = texture
  motes.emitter = new Vector3(0, 5, 25)
  motes.minEmitBox = new Vector3(-62, -3, -75)
  motes.maxEmitBox = new Vector3(62, 18, 75)
  motes.color1 = new Color4(1, 0.66, 0.34, 0.65)
  motes.color2 = new Color4(0.48, 0.62, 1, 0.45)
  motes.colorDead = new Color4(0.16, 0.19, 0.32, 0)
  motes.minSize = 0.035
  motes.maxSize = 0.12
  motes.minLifeTime = 3
  motes.maxLifeTime = 8
  motes.emitRate = 26
  motes.direction1 = new Vector3(-0.2, 0.05, -0.15)
  motes.direction2 = new Vector3(0.2, 0.4, 0.15)
  motes.minEmitPower = 0.08
  motes.maxEmitPower = 0.24
  motes.updateSpeed = 0.015
  motes.start()
}

function isWalkable(x, z, colliders, environmentBounds = []) {
  return isWorldPositionWalkable(x, z, {
    worldLimit: WORLD_LIMIT,
    playerRadius: PLAYER_RADIUS,
    circleColliders: colliders,
    boxColliders: environmentBounds,
  })
}

function isNearProtectedArea(x, z, clearance) {
  const zones = [
    { x: 0, z: -7, radius: 4 },
    { x: -4.4, z: -4.5, radius: 3.2 },
    { x: 0, z: 9, radius: 4.2 },
    { x: 0, z: 24, radius: 8 },
    { x: 0, z: 40, radius: 9 },
    { x: 0, z: 52, radius: 5.5 },
    { x: 21, z: 14, radius: 4.5 },
    { x: -49, z: 45, radius: 5.5 },
    { x: 50, z: 48, radius: 7 },
    { x: -38, z: 31, radius: 5 },
    { x: 47, z: 32, radius: 5 },
    ...ENEMY_ARCHETYPES.map(({ position }) => ({ x: position.x, z: position.z, radius: 5.5 })),
  ]
  if (Math.abs(x) < 5.5 && z >= -12 && z <= 58) return true
  if (Math.abs(x - 31) < 10 && Math.abs(z) < WORLD_LIMIT) return true
  return zones.some((zone) => Math.hypot(x - zone.x, z - zone.z) < zone.radius + clearance)
}
