# MYTHIC-ARENA character assets

## Archived hero models

`megan.glb` and `remy.glb` are retained in this directory but are no longer
loaded by the active Babylon.js prototype. They are textured, skinned GLB 2.0
models with Mixamo-style skeletons and right-hand bones. The download license
and attribution records were not supplied with the original files; retain any
available provenance if these assets are redistributed or reactivated.

## Active Babylon.js heroes

Playable male and female heroes are built from Babylon primitive meshes in
`src/prototype3d/heroPrimitive.js`. Warrior, Mage, and Guardian classes share
the low-poly style used by the enemy models while retaining the selected skin
tone, hairstyle, face preset, and outfit. The right-hand transform node remains
the weapon attachment point.

The active heroes do not load GLB or FBX character or animation assets. Their
existing controller motion states pose the primitive rig directly.
