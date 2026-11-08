export function createPrismaAdapter({ fetchImpl = globalThis.fetch } = {}) {
  return {
    isConfigured: typeof fetchImpl === 'function',
    async transcribe(audio, { signal } = {}) {
      const response = await fetchImpl('/api/voice/transcribe', {
        method: 'POST', headers: { 'Content-Type': 'audio/wav' }, body: audio, signal,
      })
      const result = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(result.error || 'Speech recognition failed.')
      return result
    },
  }
}
