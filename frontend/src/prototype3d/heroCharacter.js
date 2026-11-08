import { Quaternion, Vector3 } from '@babylonjs/core/Maths/math.vector.js'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js'
import { createPrimitiveHero } from './heroPrimitive.js'
import { createEquipmentAppearance } from './equipmentAppearance.js'
import { createDefaultEquipment, EQUIPMENT_SLOTS } from './systems/equipment.js'

export function createHeroCharacter(scene, shadows, hero, onAssetStatus) {
  const root = new TransformNode('hero-controller-root', scene)
  root.position.set(0, 0, -7)
  root.rotationQuaternion = Quaternion.Identity()

  const rig = createPrimitiveHero(scene, root, hero, shadows)
  const equipmentNodes = new Map()
  let activeWeapon = null
  const heroCharacter = {
    root,
    modelType: 'primitive',
    isAssetLoaded: false,
    availableMotions: new Set(),
    missingMotions: [],
    weaponAnchor: rig.joints.armRight,
    joints: rig.joints,
    appearance: { gender: rig.gender, classId: rig.classId },
    setMotion(motion, deltaSeconds = 1 / 60) {
      animatePrimitiveRig(rig, motion, deltaSeconds)
    },
    playAction() {
      // Actions are represented by the controller's existing setMotion state.
      return false
    },
    applyEquipment(loadout = {}) {
      for (const node of equipmentNodes.values()) {
        for (const visual of node.metadata?.linkedNodes ?? [node]) {
          visual.getChildMeshes().forEach((mesh) => shadows?.removeShadowCaster?.(mesh))
          visual.dispose(false, true)
        }
      }
      equipmentNodes.clear()
      activeWeapon = null
      for (const slot of EQUIPMENT_SLOTS) {
        const itemId = loadout[slot]
        if (!itemId) continue
        const node = createEquipmentAppearance(scene, itemId, rig, root)
        if (node) {
          equipmentNodes.set(slot, node)
          for (const visual of node.metadata?.linkedNodes ?? [node]) {
            visual.getChildMeshes().forEach((mesh) => shadows?.addShadowCaster?.(mesh))
          }
          if (slot === 'mainHand') activeWeapon = node
        }
      }
      return equipmentNodes
    },
    attachWeapon(parent = this.weaponAnchor) {
      if (!activeWeapon) this.applyEquipment(createDefaultEquipment(rig.classId))
      if (activeWeapon) activeWeapon.parent = parent ?? root
      return activeWeapon
    },
    equipped: equipmentNodes,
    dispose() {
      root.dispose(false, false)
    },
  }
  heroCharacter.applyEquipment({ mainHand: 'sunforged-blade' })
  heroCharacter.ready = Promise.resolve(heroCharacter).then((readyCharacter) => {
    onAssetStatus?.('primitive')
    return readyCharacter
  })
  return heroCharacter
}

// Primitive hero motion is retained; equipment meshes ride the same joint sockets.

function animatePrimitiveRig(rig, motion, deltaSeconds) {
  rig.time = (rig.time ?? 0) + deltaSeconds
  const moving = ['walk', 'run', 'sprint', 'dodge'].includes(motion)
  const speed = motion === 'sprint' ? 14 : motion === 'dodge' ? 17 : motion === 'run' ? 10 : 6
  const stride = moving ? Math.sin(rig.time * speed) : 0
  const blend = Math.min(deltaSeconds * 8, 1)
  const torsoPitch = motion === 'heavy-attack' ? -0.48 : motion === 'dodge' ? -0.24 : motion === 'block' ? -0.12 : 0
  rig.joints.torso.rotation.x += (torsoPitch - rig.joints.torso.rotation.x) * blend
  rig.joints.torso.position.y += ((1.17 + (motion === 'jump' ? 0.08 : moving ? Math.abs(stride) * 0.035 : Math.sin(rig.time * 1.3) * 0.012)) - rig.joints.torso.position.y) * blend
  const rightArmTarget = motion === 'block' ? -0.95 : moving ? stride * 0.42 : motion === 'attack' ? -0.85 : Math.sin(rig.time) * 0.025
  const leftArmTarget = motion === 'block' ? -0.7 : moving ? -stride * 0.42 : motion === 'attack' ? 0.7 : Math.sin(rig.time + 0.4) * 0.025
  rig.joints.armRight.rotation.x += (rightArmTarget - rig.joints.armRight.rotation.x) * blend
  rig.joints.armLeft.rotation.x += (leftArmTarget - rig.joints.armLeft.rotation.x) * blend
  rig.joints.legRight.rotation.x += ((moving ? -stride * 0.62 : 0) - rig.joints.legRight.rotation.x) * blend
  rig.joints.legLeft.rotation.x += ((moving ? stride * 0.62 : 0) - rig.joints.legLeft.rotation.x) * blend
}
