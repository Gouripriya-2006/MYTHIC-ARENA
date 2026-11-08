import { Color3 } from '@babylonjs/core/Maths/math.color.js'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js'
import { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder.js'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js'
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js'

export function createEnemyAppearance(scene, archetype, shadows) {
  const root = new TransformNode(`${archetype.id}-enemy`, scene)
  root.position.copyFromFloats(archetype.position.x, archetype.position.y, archetype.position.z)
  const palette = Object.fromEntries(Object.entries(archetype.appearance).map(([key, color]) => [
    key,
    makeMaterial(scene, `${archetype.id}-${key}`, color),
  ]))

  switch (archetype.appearance.silhouette) {
    case 'small-raider':
      buildGoblin(scene, root, palette)
      break
    case 'hooded-archer':
      buildArcher(scene, root, palette)
      break
    case 'quadruped':
      buildShadowBeast(scene, root, palette)
      break
    case 'lava-brute':
      buildFireMonster(scene, root, palette)
      break
    case 'heavy-guardian':
      buildEliteGuardian(scene, root, palette)
      break
    default:
      throw new Error(`No enemy appearance is registered for ${archetype.id}.`)
  }

  root.getChildMeshes().forEach((mesh) => {
    mesh.isPickable = false
    shadows.addShadowCaster(mesh)
  })
  return { root }
}

function buildGoblin(scene, root, palette) {
  const torso = createMesh(CreateCylinder, 'goblin-leather-tunic', { height: 1.05, diameterTop: 0.48, diameterBottom: 0.72, tessellation: 8 }, root, palette.cloth)
  torso.position.y = 0.92
  const belt = createMesh(CreateTorus, 'goblin-brass-belt', { diameter: 0.72, thickness: 0.1, tessellation: 12 }, root, palette.accent)
  belt.position.y = 0.58
  belt.rotation.x = Math.PI / 2
  const head = createMesh(CreateSphere, 'goblin-green-head', { diameter: 0.63, segments: 10 }, root, palette.skin)
  head.position.y = 1.68
  head.scaling.set(0.92, 0.82, 0.82)

  for (const side of [-1, 1]) {
    const ear = createMesh(CreateCylinder, `goblin-pointed-ear-${side}`, { height: 0.46, diameterTop: 0, diameterBottom: 0.3, tessellation: 4 }, root, palette.skin)
    ear.position.set(side * 0.42, 1.76, 0)
    ear.rotation.z = -side * 0.82
    const tusk = createMesh(CreateCylinder, `goblin-ivory-tusk-${side}`, { height: 0.2, diameterTop: 0, diameterBottom: 0.09, tessellation: 5 }, root, palette.accent)
    tusk.position.set(side * 0.15, 1.4, 0.24)
  }

  const helmet = createMesh(CreatePolyhedron, 'goblin-scrap-helmet', { type: 1, size: 0.38 }, root, palette.armor)
  helmet.position.set(0, 1.98, 0)
  const club = createMesh(CreateCylinder, 'goblin-spiked-club', { height: 0.95, diameterTop: 0.12, diameterBottom: 0.19, tessellation: 7 }, root, palette.cloth)
  club.position.set(0.63, 0.91, 0.04)
  club.rotation.z = -0.58
  const clubHead = createMesh(CreateSphere, 'goblin-club-stone', { diameter: 0.38, segments: 7 }, root, palette.armor)
  clubHead.position.set(0.94, 1.3, 0.04)

  for (const side of [-1, 1]) {
    const leg = createMesh(CreateCylinder, `goblin-boot-${side}`, { height: 0.62, diameterTop: 0.25, diameterBottom: 0.32, tessellation: 7 }, root, palette.skin)
    leg.position.set(side * 0.22, 0.19, 0)
  }
}

function buildArcher(scene, root, palette) {
  const robe = createMesh(CreateCylinder, 'dark-archer-long-coat', { height: 1.45, diameterTop: 0.5, diameterBottom: 0.86, tessellation: 9 }, root, palette.cloth)
  robe.position.y = 0.94
  const hood = createMesh(CreateCylinder, 'dark-archer-pointed-hood', { height: 0.72, diameterTop: 0.04, diameterBottom: 0.72, tessellation: 8 }, root, palette.armor)
  hood.position.y = 1.9
  const face = createMesh(CreateSphere, 'dark-archer-shadowed-face', { diameter: 0.43, segments: 8 }, root, palette.skin)
  face.position.set(0, 1.66, 0.15)
  const bow = createMesh(CreateTorus, 'dark-archer-curved-bow', { diameter: 1.12, thickness: 0.065, tessellation: 16 }, root, palette.accent)
  bow.position.set(0.68, 1.18, 0.16)
  const quiver = createMesh(CreateBox, 'dark-archer-back-quiver', { width: 0.3, height: 0.92, depth: 0.26 }, root, palette.armor)
  quiver.position.set(-0.4, 1.16, -0.34)
  for (let index = -1; index <= 1; index += 1) {
    const arrow = createMesh(CreateCylinder, `dark-archer-quiver-arrow-${index}`, { height: 0.96, diameterTop: 0.018, diameterBottom: 0.035, tessellation: 5 }, root, palette.accent)
    arrow.position.set(-0.4 + index * 0.09, 1.56, -0.35)
    arrow.rotation.z = index * 0.08
  }
  for (const side of [-1, 1]) {
    const arm = createMesh(CreateCylinder, `dark-archer-sleeve-${side}`, { height: 0.72, diameterTop: 0.18, diameterBottom: 0.23, tessellation: 7 }, root, palette.cloth)
    arm.position.set(side * 0.43, 1.1, 0.08)
    arm.rotation.z = side * 0.32
  }
}

function buildShadowBeast(scene, root, palette) {
  const body = createMesh(CreateSphere, 'shadow-beast-low-slung-body', { diameter: 1.45, segments: 10 }, root, palette.skin)
  body.position.set(0, 0.78, -0.02)
  body.scaling.set(1.12, 0.62, 0.72)
  const mane = createMesh(CreatePolyhedron, 'shadow-beast-spiked-mane', { type: 1, size: 0.6 }, root, palette.cloth)
  mane.position.set(0, 1.12, 0.2)
  mane.scaling.set(1.1, 0.75, 0.72)
  const head = createMesh(CreateSphere, 'shadow-beast-fanged-head', { diameter: 0.65, segments: 8 }, root, palette.skin)
  head.position.set(0, 0.93, 0.72)
  for (const side of [-1, 1]) {
    const horn = createMesh(CreateCylinder, `shadow-beast-horn-${side}`, { height: 0.45, diameterTop: 0, diameterBottom: 0.22, tessellation: 5 }, root, palette.armor)
    horn.position.set(side * 0.23, 1.35, 0.57)
    horn.rotation.x = 0.25
    const eye = createMesh(CreateSphere, `shadow-beast-glowing-eye-${side}`, { diameter: 0.09, segments: 6 }, root, palette.accent)
    eye.position.set(side * 0.19, 1.03, 1.01)
  }
  for (const side of [-1, 1]) {
    for (const fore of [-1, 1]) {
      const leg = createMesh(CreateCylinder, `shadow-beast-${fore > 0 ? 'front' : 'rear'}-leg-${side}`, { height: 0.72, diameterTop: 0.18, diameterBottom: 0.28, tessellation: 6 }, root, palette.skin)
      leg.position.set(side * 0.43, 0.35, fore * 0.42)
      leg.rotation.x = fore * -0.1
    }
  }
  const tail = createMesh(CreateCylinder, 'shadow-beast-barbed-tail', { height: 1.05, diameterTop: 0.04, diameterBottom: 0.18, tessellation: 6 }, root, palette.armor)
  tail.position.set(0, 1.06, -0.78)
  tail.rotation.x = Math.PI / 2.7
}

function buildFireMonster(scene, root, palette) {
  const torso = createMesh(CreatePolyhedron, 'fire-monster-cracked-lava-core', { type: 1, size: 0.95 }, root, palette.skin)
  torso.position.y = 1.2
  torso.scaling.set(0.88, 1.12, 0.8)
  const chest = createMesh(CreateSphere, 'fire-monster-molten-chest', { diameter: 0.58, segments: 8 }, root, palette.accent)
  chest.position.set(0, 1.35, 0.62)
  for (const side of [-1, 1]) {
    const horn = createMesh(CreateCylinder, `fire-monster-cinder-horn-${side}`, { height: 0.72, diameterTop: 0, diameterBottom: 0.32, tessellation: 5 }, root, palette.armor)
    horn.position.set(side * 0.45, 2.0, 0.05)
    horn.rotation.z = -side * 0.45
    const arm = createMesh(CreateCylinder, `fire-monster-basalt-arm-${side}`, { height: 1.0, diameterTop: 0.3, diameterBottom: 0.46, tessellation: 6 }, root, palette.armor)
    arm.position.set(side * 0.72, 1.15, 0)
    arm.rotation.z = side * 0.24
    const leg = createMesh(CreateCylinder, `fire-monster-rock-leg-${side}`, { height: 0.76, diameterTop: 0.38, diameterBottom: 0.48, tessellation: 6 }, root, palette.cloth)
    leg.position.set(side * 0.32, 0.36, 0)
    const flame = createMesh(CreateCylinder, `fire-monster-flame-spike-${side}`, { height: 0.68, diameterTop: 0, diameterBottom: 0.26, tessellation: 5 }, root, palette.accent)
    flame.position.set(side * 0.33, 1.46, -0.34)
    flame.rotation.z = -side * 0.32
  }
}

function buildEliteGuardian(scene, root, palette) {
  root.scaling.setAll(1.2)
  const armor = createMesh(CreateCylinder, 'elite-guardian-plated-cuirass', { height: 1.65, diameterTop: 0.78, diameterBottom: 1.08, tessellation: 10 }, root, palette.armor)
  armor.position.y = 1.18
  const chest = createMesh(CreateBox, 'elite-guardian-chest-plate', { width: 0.82, height: 0.62, depth: 0.24 }, root, palette.cloth)
  chest.position.set(0, 1.36, 0.47)
  const helm = createMesh(CreateSphere, 'elite-guardian-visored-helm', { diameter: 0.74, segments: 10 }, root, palette.armor)
  helm.position.y = 2.25
  const crest = createMesh(CreateCylinder, 'elite-guardian-gold-crest', { height: 0.62, diameterTop: 0.08, diameterBottom: 0.35, tessellation: 5 }, root, palette.accent)
  crest.position.set(0, 2.72, 0)
  const shield = createMesh(CreateBox, 'elite-guardian-tower-shield', { width: 0.9, height: 1.46, depth: 0.2 }, root, palette.accent)
  shield.position.set(-0.9, 1.2, 0.16)
  shield.rotation.z = -0.12
  const maul = createMesh(CreateCylinder, 'elite-guardian-war-maul', { height: 1.75, diameterTop: 0.18, diameterBottom: 0.13, tessellation: 8 }, root, palette.cloth)
  maul.position.set(0.88, 1.0, 0.1)
  maul.rotation.z = -0.18
  const maulHead = createMesh(CreateBox, 'elite-guardian-maul-head', { width: 0.52, height: 0.58, depth: 0.48 }, root, palette.armor)
  maulHead.position.set(1.02, 1.98, 0.1)
  for (const side of [-1, 1]) {
    const greave = createMesh(CreateCylinder, `elite-guardian-greave-${side}`, { height: 0.78, diameterTop: 0.34, diameterBottom: 0.46, tessellation: 8 }, root, palette.armor)
    greave.position.set(side * 0.32, 0.38, 0)
  }
}

function createMesh(builder, name, options, parent, material) {
  const mesh = builder(name, options, parent.getScene())
  mesh.parent = parent
  mesh.material = material
  return mesh
}

function makeMaterial(scene, name, hex) {
  const material = new StandardMaterial(name, scene)
  material.diffuseColor = Color3.FromHexString(hex)
  material.specularColor = new Color3(0.14, 0.13, 0.1)
  material.specularPower = 28
  if (name.includes('fireMonster-accent') || name.includes('shadowBeast-accent')) {
    material.emissiveColor = Color3.FromHexString(hex).scale(0.65)
  }
  return material
}
