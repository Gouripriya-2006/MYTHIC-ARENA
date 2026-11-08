export function shouldStartNewAdventure(requested, existingProgress) {
  return Boolean(requested)
}

export function archiveCurrentSave(storage, saveKey, timestamp = Date.now()) {
  const serialized = storage?.getItem(saveKey)
  if (serialized == null) return null

  const baseKey = `${saveKey}-archive-${timestamp}`
  let archiveKey = baseKey
  let suffix = 1
  while (storage.getItem(archiveKey) != null) {
    archiveKey = `${baseKey}-${suffix}`
    suffix += 1
  }
  storage.setItem(archiveKey, serialized)
  return archiveKey
}
