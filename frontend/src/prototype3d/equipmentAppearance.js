import { Color3 } from '@babylonjs/core/Maths/math.color.js'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js'
import { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder.js'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js'
import { EQUIPMENT_BY_ID } from './systems/equipment.js'

export function createEquipmentAppearance(scene, itemId, rig, root) {
  const item = EQUIPMENT_BY_ID[itemId]
  if (!item) return null
  const slot = item.slot
  const anchor = slot === 'mainHand' ? rig.joints.armRight
    : slot === 'offHand' ? rig.joints.armLeft
      : slot === 'armor' ? rig.joints.torso
        : slot === 'helmet' ? root
          : slot === 'gloves' ? rig.joints.armRight
            : rig.joints.legRight
  const appearance = new TransformNode(`equipment-${itemId}`, scene)
  appearance.parent = anchor
  if (slot === 'mainHand' || slot === 'offHand') {
    appearance.name = slot === 'mainHand' ? 'hero-right-hand-weapon-socket' : 'hero-left-hand-equipment-socket'
    appearance.position.set(slot === 'mainHand' ? 0.13 : -0.13, -0.02, 0.02)
    appearance.rotation.set(Math.PI / 2, 0, slot === 'mainHand' ? Math.PI / 2 : -Math.PI / 2)
    buildWeapon(scene, appearance, item)
  } else {
    appearance.position.set(0, slot === 'helmet' ? 1.96 : slot === 'armor' ? 0.04 : 0, 0)
    buildArmor(scene, appearance, item)
    if (slot === 'gloves' || slot === 'boots') {
      const oppositeJoint = slot === 'gloves' ? rig.joints.armLeft : rig.joints.legLeft
      const opposite = new TransformNode(`equipment-${itemId}-left`, scene)
      opposite.parent = oppositeJoint
      buildArmor(scene, opposite, item)
      appearance.metadata = { linkedNodes: [appearance, opposite] }
    }
  }
  return appearance
}

function buildWeapon(scene, root, item) {
  const metal = material(scene, `${item.id}-metal`, item.color, 0.55)
  const accent = material(scene, `${item.id}-accent`, item.accent, 0.18)
  const wood = material(scene, `${item.id}-wood`, item.kind === 'staff' || item.kind === 'wand' ? '#67452d' : item.accent, 0.08)
  const part = (builder, name, options, y, mat, x = 0) => {
    const meshName = item.id === 'sunforged-blade' && name === 'blade' ? 'wayfarer-sword-blade' : `${item.id}-${name}`
    const mesh = builder(meshName, options, scene)
    mesh.parent = root
    mesh.position.set(x, y, 0)
    mesh.material = mat
    mesh.isPickable = false
    return mesh
  }
  if (item.kind === 'shield') {
    part(CreateBox, 'shield-core', { width: 0.48, height: 0.62, depth: 0.12 }, 0, metal)
    part(CreatePolyhedron, 'shield-boss', { type: 1, size: 0.2 }, 0.02, accent)
    part(CreateBox, 'shield-rim', { width: 0.54, height: 0.07, depth: 0.14 }, 0.29, accent)
  } else if (item.kind === 'staff' || item.kind === 'wand') {
    const length = item.kind === 'staff' ? 1.48 : 0.72
    part(CreateCylinder, 'shaft', { height: length, diameter: item.kind === 'staff' ? 0.075 : 0.055, tessellation: 7 }, length * 0.36, wood)
    part(CreateSphere, 'focus-orb', { diameter: item.kind === 'staff' ? 0.27 : 0.19, segments: 7 }, length * 0.78, accent)
    if (item.kind === 'staff') part(CreatePolyhedron, 'orb-cage', { type: 1, size: 0.22 }, length * 0.78, metal)
  } else if (item.kind === 'axe') {
    part(CreateCylinder, 'haft', { height: 0.98, diameter: 0.07, tessellation: 7 }, 0.31, wood)
    part(CreateBox, 'axe-head', { width: 0.58, height: 0.28, depth: 0.09 }, 0.78, metal)
    part(CreatePolyhedron, 'axe-edge', { type: 1, size: 0.24 }, 0.78, metal, 0.2)
  } else {
    const large = item.kind === 'greatSword'
    part(CreateBox, 'blade', { width: large ? 0.17 : 0.095, height: large ? 1.08 : 0.82, depth: 0.045 }, large ? 0.59 : 0.5, metal)
    part(CreateBox, 'guard', { width: large ? 0.48 : 0.34, height: 0.075, depth: 0.095 }, 0.06, accent)
    part(CreateCylinder, 'grip', { height: 0.25, diameter: 0.07, tessellation: 8 }, -0.1, wood)
    part(CreateSphere, 'pommel', { diameter: 0.11, segments: 6 }, -0.25, accent)
  }
}

function buildArmor(scene, root, item) {
  const metal = material(scene, `${item.id}-armor`, item.color, 0.28)
  const trim = material(scene, `${item.id}-trim`, item.accent, 0.15)
  const piece = (builder, name, options, position, mat, scaling) => {
    const mesh = builder(`${item.id}-${name}`, options, scene)
    mesh.parent = root
    mesh.position.set(...position)
    if (scaling) mesh.scaling.set(...scaling)
    mesh.material = mat
    mesh.isPickable = false
  }
  if (item.slot === 'armor') {
    if (item.kind === 'robe') {
      piece(CreateCylinder, 'robe', { height: 1.05, diameterTop: 0.6, diameterBottom: 0.9, tessellation: 8 }, [0, 0, 0], metal)
      piece(CreateBox, 'robe-sash', { width: 0.68, height: 0.12, depth: 0.68 }, [0, 0.1, 0.02], trim)
    } else {
      piece(CreateBox, 'cuirass', { width: 0.72, height: 0.8, depth: 0.34 }, [0, 0, 0.02], metal)
      piece(CreateBox, 'chest-trim', { width: 0.1, height: 0.52, depth: 0.04 }, [0, 0, 0.21], trim)
      if (item.kind === 'heavyArmor' || item.kind === 'guardianArmor') {
        for (const side of [-1, 1]) piece(CreateSphere, `pauldron-${side}`, { diameter: 0.42, segments: 6 }, [side * 0.42, 0.3, 0], metal)
      }
    }
  } else if (item.slot === 'helmet') {
    piece(CreateCylinder, 'helm-cap', { height: 0.34, diameterTop: 0.37, diameterBottom: 0.55, tessellation: 7 }, [0, 0.18, 0], metal)
    piece(CreateBox, 'helm-brow', { width: 0.5, height: 0.09, depth: 0.13 }, [0, 0.02, 0.23], trim)
  } else if (item.slot === 'gloves') {
    piece(CreateCylinder, 'glove-cuff', { height: 0.36, diameterTop: 0.26, diameterBottom: 0.22, tessellation: 6 }, [0, -0.45, 0], metal)
    piece(CreateSphere, 'glove-hand', { diameter: 0.22, segments: 6 }, [0, -0.64, 0], trim)
  } else {
    piece(CreateBox, 'boot-shin', { width: 0.3, height: 0.34, depth: 0.34 }, [0, -0.52, 0.04], metal)
    piece(CreateBox, 'boot-toe', { width: 0.34, height: 0.17, depth: 0.42 }, [0, -0.66, 0.08], trim)
  }
}

function material(scene, name, color, metallic) {
  const result = new StandardMaterial(name, scene)
  result.diffuseColor = Color3.FromHexString(color)
  result.specularColor = new Color3(0.55, 0.5, 0.42)
  result.specularPower = 36
  result.metallic = metallic
  return result
}
