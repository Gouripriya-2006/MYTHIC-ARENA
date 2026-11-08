import assert from 'node:assert/strict'
import test from 'node:test'
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js'
import { Scene } from '@babylonjs/core/scene.js'
import { createHeroCharacter } from './heroCharacter.js'

function createTestHero(gender, classId = 'warrior', appearance = {}) {
  const engine = new NullEngine()
  const scene = new Scene(engine)
  const shadowCasters = []
  let status
  const character = createHeroCharacter(scene, { addShadowCaster: (mesh) => shadowCasters.push(mesh) }, {
    gender,
    classId,
    appearance: {
      skinToneId: 'bronze',
      hairstyleId: 'long',
      faceId: 'wanderer',
      outfitId: 'sunforged',
      ...appearance,
    },
  }, (value) => { status = value })
  return { engine, scene, character, shadowCasters, getStatus: () => status }
}

test('male Hero and female Heroine have distinct primitive silhouettes and no GLB runtime state', async () => {
  const male = createTestHero('male')
  const female = createTestHero('female')
  await Promise.all([male.character.ready, female.character.ready])

  assert.equal(male.character.modelType, 'primitive')
  assert.equal(female.character.modelType, 'primitive')
  assert.equal(male.character.appearance.gender, 'male')
  assert.equal(female.character.appearance.gender, 'female')
  assert.equal(Math.abs(male.character.joints.armRight.position.x), 0.48)
  assert.equal(Math.abs(female.character.joints.armRight.position.x), 0.4)
  assert.ok(male.scene.meshes.length >= 25)
  assert.ok(female.scene.meshes.length >= 25)
  assert.equal(male.scene.skeletons.length, 0)
  assert.equal(male.scene.animationGroups.length, 0)
  assert.equal(male.character.isAssetLoaded, false)
  assert.deepEqual(male.character.missingMotions, [])
  assert.equal(male.getStatus(), 'primitive')
  assert.equal(female.getStatus(), 'primitive')
  male.scene.dispose(); male.engine.dispose()
  female.scene.dispose(); female.engine.dispose()
})

test('Warrior, Mage, and Guardian each receive distinct class-specific primitive details', async () => {
  const heroes = ['warrior', 'mage', 'guardian'].map((classId) => createTestHero('male', classId))
  await Promise.all(heroes.map(({ character }) => character.ready))

  assert.ok(heroes[0].scene.getMeshByName('hero-warrior-breastplate'))
  assert.ok(heroes[1].scene.getMeshByName('hero-mage-focus-gem'))
  assert.ok(heroes[2].scene.getMeshByName('hero-guardian-emblem'))
  const armorColors = heroes.map(({ scene }, index) => scene.getMeshByName([
    'hero-warrior-breastplate', 'hero-mage-high-collar', 'hero-guardian-chest-plate',
  ][index]))
    .map(({ material }) => material.diffuseColor.toHexString())
  assert.equal(new Set(armorColors).size, 3)
  heroes.forEach(({ scene, engine }) => { scene.dispose(); engine.dispose() })
})

test('skin tone, hairstyle, face preset, and outfit customization change the primitive appearance', async () => {
  const defaultHero = createTestHero('female', 'mage')
  const customHero = createTestHero('female', 'mage', {
    skinToneId: 'deep',
    hairstyleId: 'braided',
    faceId: 'marked',
    outfitId: 'verdant',
  })
  await Promise.all([defaultHero.character.ready, customHero.character.ready])

  const getColor = (scene, name) => scene.getMeshByName(name).material.diffuseColor.toHexString()
  assert.notEqual(getColor(defaultHero.scene, 'hero-head'), getColor(customHero.scene, 'hero-head'))
  assert.notEqual(getColor(defaultHero.scene, 'hero-tailored-tunic'), getColor(customHero.scene, 'hero-tailored-tunic'))
  assert.ok(defaultHero.scene.getMeshByName('hero-flowing-hair-back'))
  assert.ok(customHero.scene.getMeshByName('hero-braid-1'))
  assert.ok(defaultHero.scene.getMeshByName('hero-wanderer-scar'))
  assert.ok(customHero.scene.getMeshByName('hero-rune-mark'))
  defaultHero.scene.dispose(); defaultHero.engine.dispose()
  customHero.scene.dispose(); customHero.engine.dispose()
})

test('weapon socket remains attached to the animated right hand and controller motions remain available', async () => {
  const fixture = createTestHero('male', 'guardian')
  await fixture.character.ready
  const { character, scene } = fixture
  const socket = scene.getTransformNodeByName('hero-right-hand-weapon-socket')
  assert.equal(character.weaponAnchor, character.joints.armRight)
  assert.equal(socket.parent, character.weaponAnchor)
  assert.ok(socket.getChildMeshes().some(({ name }) => name === 'wayfarer-sword-blade'))

  character.setMotion('walk', 0.1)
  assert.notEqual(character.joints.legLeft.rotation.x, 0)
  assert.equal(character.attachWeapon(character.joints.armLeft), socket)
  assert.equal(socket.parent, character.joints.armLeft)
  fixture.scene.dispose(); fixture.engine.dispose()
})
