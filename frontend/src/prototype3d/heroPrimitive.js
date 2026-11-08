import { Color3 } from '@babylonjs/core/Maths/math.color.js'
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js'
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js'
import { CreateBox } from '@babylonjs/core/Meshes/Builders/boxBuilder.js'
import { CreateCylinder } from '@babylonjs/core/Meshes/Builders/cylinderBuilder.js'
import { CreatePolyhedron } from '@babylonjs/core/Meshes/Builders/polyhedronBuilder.js'
import { CreateSphere } from '@babylonjs/core/Meshes/Builders/sphereBuilder.js'
import { CreateTorus } from '@babylonjs/core/Meshes/Builders/torusBuilder.js'
import { getAppearanceOption, getCharacter } from '../game/data/characters.js'

const SKIN_TONES = {
  porcelain: '#e6bfa3',
  sand: '#c99570',
  bronze: '#a66b48',
  umber: '#74442f',
  deep: '#4c3028',
}

export function createPrimitiveHero(scene, root, hero, shadows) {
  const gender = hero.gender === 'female' ? 'female' : 'male'
  const isHeroine = gender === 'female'
  const character = getCharacter(hero.classId) ?? getCharacter('warrior')
  const outfit = getAppearanceOption('outfits', hero.appearance?.outfitId)
  const skin = material(scene, 'hero-skin', SKIN_TONES[hero.appearance?.skinToneId] ?? SKIN_TONES.bronze)
  const cloth = material(scene, 'hero-outfit', outfit?.color ?? '#b4874e')
  const armor = material(scene, 'hero-class-armor', `#${character.color.toString(16).padStart(6, '0')}`)
  const trim = material(scene, 'hero-outfit-accent', outfit?.accent ?? '#e7c77f')
  const hair = material(scene, 'hero-hair', '#241a19')
  const dark = material(scene, 'hero-detail', '#211920')
  const joints = {}

  const torso = new TransformNode('hero-torso-joint', scene)
  torso.parent = root
  torso.position.y = 1.17
  joints.torso = torso

  const torsoTop = isHeroine ? 0.58 : 0.76
  const torsoBottom = isHeroine ? 0.7 : 0.66
  const body = make(CreateCylinder, 'hero-tailored-tunic', { height: 1.02, diameterTop: torsoTop, diameterBottom: torsoBottom, tessellation: 9 }, torso, cloth)
  body.position.y = -0.02
  const chest = make(CreateCylinder, 'hero-upper-tunic', { height: 0.48, diameterTop: torsoTop, diameterBottom: isHeroine ? 0.62 : 0.72, tessellation: 9 }, torso, cloth)
  chest.position.y = 0.27
  const hips = make(CreateCylinder, 'hero-hip-guard', { height: 0.38, diameterTop: torsoBottom, diameterBottom: isHeroine ? 0.82 : 0.72, tessellation: 9 }, root, armor)
  hips.position.y = 0.77
  const belt = make(CreateTorus, 'hero-outfit-belt', { diameter: isHeroine ? 0.76 : 0.7, thickness: 0.085, tessellation: 10 }, root, trim)
  belt.position.y = 0.83
  belt.rotation.x = Math.PI / 2

  const head = make(CreateSphere, 'hero-head', { diameter: 0.54, segments: 9 }, root, skin)
  head.position.set(0, 1.99, 0)
  head.scaling.set(isHeroine ? 0.86 : 0.92, 1.05, 0.9)
  make(CreateSphere, 'hero-eye-left', { diameter: 0.045, segments: 6 }, root, dark).position.set(-0.09, 2.01, 0.24)
  make(CreateSphere, 'hero-eye-right', { diameter: 0.045, segments: 6 }, root, dark).position.set(0.09, 2.01, 0.24)
  buildHair(scene, root, hero.appearance?.hairstyleId, hair, trim, isHeroine)
  buildFaceDetail(scene, root, hero.appearance?.faceId, armor, trim)
  buildClassDetails(scene, root, joints, hero.classId, armor, trim, cloth, isHeroine)

  for (const side of [-1, 1]) {
    const sideName = side === 1 ? 'Right' : 'Left'
    const shoulderWidth = isHeroine ? 0.4 : 0.48
    const shoulder = make(CreateSphere, `hero-${sideName.toLowerCase()}-pauldron`, { diameter: isHeroine ? 0.34 : 0.4, segments: 7 }, torso, armor)
    shoulder.position.set(side * shoulderWidth, 0.22, 0)

    const armJoint = new TransformNode(`hero-arm-joint-${sideName.toLowerCase()}`, scene)
    armJoint.parent = root
    armJoint.position.set(side * shoulderWidth, 1.5, 0)
    joints[`arm${sideName}`] = armJoint
    const upperArm = make(CreateCylinder, `hero-${sideName.toLowerCase()}-arm`, { height: 0.61, diameterTop: 0.2, diameterBottom: 0.26, tessellation: 7 }, armJoint, skin)
    upperArm.position.y = -0.3
    const bracer = make(CreateCylinder, `hero-${sideName.toLowerCase()}-bracer`, { height: 0.34, diameterTop: 0.23, diameterBottom: 0.2, tessellation: 7 }, armJoint, armor)
    bracer.position.set(0, -0.49, 0.015)
    const hand = make(CreateSphere, `hero-${sideName.toLowerCase()}-hand`, { diameter: 0.21, segments: 7 }, armJoint, skin)
    hand.position.y = -0.62

    const legJoint = new TransformNode(`hero-leg-joint-${sideName.toLowerCase()}`, scene)
    legJoint.parent = root
    legJoint.position.set(side * (isHeroine ? 0.21 : 0.23), 0.72, 0)
    joints[`leg${sideName}`] = legJoint
    const leg = make(CreateCylinder, `hero-${sideName.toLowerCase()}-greave`, { height: 0.69, diameterTop: 0.28, diameterBottom: 0.34, tessellation: 7 }, legJoint, cloth)
    leg.position.y = -0.34
    const boot = make(CreateBox, `hero-${sideName.toLowerCase()}-boot`, { width: 0.31, height: 0.18, depth: 0.42 }, legJoint, armor)
    boot.position.set(0, -0.63, 0.055)
  }

  root.getChildMeshes(false).forEach((mesh) => {
    mesh.isPickable = false
    mesh.receiveShadows = true
    shadows?.addShadowCaster?.(mesh)
  })

  return { joints, head, gender, classId: character.id }
}

function buildHair(scene, root, style, hair, accent, isHeroine) {
  const cap = make(CreateSphere, 'hero-hairstyle-cap', { diameter: isHeroine ? 0.59 : 0.56, segments: 8 }, root, hair)
  cap.position.set(0, 2.17, -0.015)
  cap.scaling.set(1, 0.48, 1)

  if (style === 'cropped') {
    cap.scaling.set(1, 0.28, 1)
  } else if (style === 'crest') {
    cap.scaling.set(0.75, 0.58, 0.78)
    const crest = make(CreatePolyhedron, 'hero-crest-hairstyle', { type: 1, size: 0.24 }, root, hair)
    crest.position.set(0, 2.35, -0.005)
    crest.scaling.set(0.5, 1.25, 0.5)
  } else if (style === 'braided') {
    for (const side of [-1, 1]) {
      const braid = make(CreateCylinder, `hero-braid-${side}`, { height: 0.6, diameterTop: 0.1, diameterBottom: 0.15, tessellation: 6 }, root, hair)
      braid.position.set(side * 0.23, 1.91, -0.08)
      braid.rotation.z = side * 0.1
      const tie = make(CreateSphere, `hero-braid-tie-${side}`, { diameter: 0.13, segments: 6 }, root, accent)
      tie.position.set(side * 0.23, 1.72, -0.08)
    }
  } else {
    for (const side of [-1, 1]) {
      const lock = make(CreateSphere, `hero-flowing-hair-${side}`, { diameter: 0.29, segments: 7 }, root, hair)
      lock.position.set(side * 0.2, 1.91, -0.035)
      lock.scaling.set(0.72, 1.45, 0.8)
    }
    if (isHeroine) {
      const back = make(CreateSphere, 'hero-flowing-hair-back', { diameter: 0.46, segments: 7 }, root, hair)
      back.position.set(0, 1.86, -0.19)
      back.scaling.set(1.05, 1.28, 0.72)
    }
  }
}

function buildFaceDetail(scene, root, faceId, armor, accent) {
  if (faceId === 'marked') {
    const rune = make(CreatePolyhedron, 'hero-rune-mark', { type: 1, size: 0.075 }, root, armor)
    rune.position.set(0.12, 1.92, 0.255)
    rune.scaling.set(0.38, 1.3, 0.3)
  } else if (faceId === 'noble') {
    const circlet = make(CreateTorus, 'hero-noble-circlet', { diameter: 0.49, thickness: 0.035, tessellation: 10 }, root, accent)
    circlet.position.set(0, 2.13, 0.01)
    circlet.rotation.x = Math.PI / 2
    const jewel = make(CreatePolyhedron, 'hero-circlet-jewel', { type: 1, size: 0.075 }, root, armor)
    jewel.position.set(0, 2.2, 0.24)
  } else {
    const scar = make(CreateBox, 'hero-wanderer-scar', { width: 0.14, height: 0.025, depth: 0.018 }, root, accent)
    scar.position.set(-0.09, 1.91, 0.253)
    scar.rotation.z = -0.24
  }
}

function buildClassDetails(scene, root, joints, classId, armor, accent, cloth, isHeroine) {
  if (classId === 'mage') {
    const mantle = make(CreateBox, 'hero-mage-shoulder-mantle', { width: isHeroine ? 0.88 : 0.96, height: 0.17, depth: 0.48 }, root, cloth)
    mantle.position.set(0, 1.52, -0.05)
    const collar = make(CreateCylinder, 'hero-mage-high-collar', { height: 0.26, diameterTop: 0.42, diameterBottom: 0.6, tessellation: 8 }, root, armor)
    collar.position.y = 1.71
    const gem = make(CreatePolyhedron, 'hero-mage-focus-gem', { type: 1, size: 0.16 }, root, accent)
    gem.position.set(0, 1.29, 0.34)
    gem.scaling.set(0.75, 1.25, 0.55)
  } else if (classId === 'guardian') {
    const chest = make(CreateBox, 'hero-guardian-chest-plate', { width: isHeroine ? 0.55 : 0.66, height: 0.49, depth: 0.2 }, joints.torso, armor)
    chest.position.set(0, 0.11, 0.34)
    const emblem = make(CreatePolyhedron, 'hero-guardian-emblem', { type: 1, size: 0.13 }, joints.torso, accent)
    emblem.position.set(0, 0.11, 0.46)
    for (const side of [-1, 1]) {
      const leaf = make(CreatePolyhedron, `hero-guardian-leaf-${side}`, { type: 1, size: 0.2 }, root, accent)
      leaf.position.set(side * 0.44, 1.45, -0.1)
      leaf.rotation.z = side * 0.45
    }
  } else {
    const breastplate = make(CreatePolyhedron, 'hero-warrior-breastplate', { type: 1, size: 0.47 }, joints.torso, armor)
    breastplate.position.set(0, 0.1, 0.34)
    breastplate.scaling.set(0.84, 1.18, 0.5)
    const crest = make(CreateBox, 'hero-warrior-chest-crest', { width: 0.12, height: 0.38, depth: 0.08 }, joints.torso, accent)
    crest.position.set(0, 0.1, 0.52)
  }
}

function make(builder, name, options, parent, meshMaterial) {
  const mesh = builder(name, options, parent.getScene())
  mesh.parent = parent
  mesh.material = meshMaterial
  mesh.isPickable = false
  return mesh
}

function material(scene, name, hex) {
  const result = new StandardMaterial(name, scene)
  result.diffuseColor = Color3.FromHexString(hex)
  result.specularColor = new Color3(0.14, 0.13, 0.1)
  result.specularPower = 28
  return result
}
