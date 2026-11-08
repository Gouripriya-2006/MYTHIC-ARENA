import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const assetDirectory = new URL('../../public/assets/characters/', import.meta.url)

async function readGlb(fileName) {
  const bytes = await readFile(new URL(fileName, assetDirectory))
  assert.equal(bytes.toString('ascii', 0, 4), 'glTF', `${fileName} GLB magic`)
  assert.equal(bytes.readUInt32LE(4), 2, `${fileName} GLB version`)
  assert.equal(bytes.readUInt32LE(8), bytes.length, `${fileName} declared length`)

  let offset = 12
  let json
  while (offset < bytes.length) {
    const chunkLength = bytes.readUInt32LE(offset)
    const chunkType = bytes.readUInt32LE(offset + 4)
    offset += 8
    if (chunkType === 0x4e4f534a) {
      json = JSON.parse(bytes.toString('utf8', offset, offset + chunkLength).replace(/[\0 ]+$/, ''))
      break
    }
    offset += chunkLength
  }
  assert.ok(json, `${fileName} JSON chunk`)
  return json
}

for (const [fileName, expectedMeshes, expectedJoints, expectedAnimations] of [
  ['megan.glb', 6, 65, 1],
  ['remy.glb', 7, 67, 0],
]) {
  test(`${fileName} contains textured skinned character assets`, async () => {
    const glb = await readGlb(fileName)
    const skinnedPrimitives = glb.meshes.flatMap((mesh) => mesh.primitives)
      .filter(({ attributes }) => attributes.JOINTS_0 !== undefined && attributes.WEIGHTS_0 !== undefined)
    const embeddedImages = glb.images.filter(({ bufferView }) => Number.isInteger(bufferView))
    const texturedMaterials = glb.materials.filter((material) => (
      Number.isInteger(material.pbrMetallicRoughness?.baseColorTexture?.index)
    ))
    const jointCount = glb.skins.reduce((total, skin) => total + skin.joints.length, 0)

    assert.equal(glb.meshes.length, expectedMeshes)
    assert.ok(skinnedPrimitives.length >= expectedMeshes)
    assert.ok(glb.skins.length > 0)
    assert.equal(jointCount, expectedJoints)
    assert.ok(glb.materials.length > 0)
    assert.ok(texturedMaterials.length > 0)
    assert.ok(embeddedImages.length > 0)
    assert.equal(glb.animations?.length ?? 0, expectedAnimations)
    assert.ok(glb.nodes.some(({ name }) => /rightHand/i.test(name)))
  })
}
