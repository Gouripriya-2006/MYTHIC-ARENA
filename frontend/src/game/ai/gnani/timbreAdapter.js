export function createTimbreAdapter({ fetchImpl = globalThis.fetch } = {}) {
  return {
    isConfigured: typeof fetchImpl === 'function',
    async synthesize(text, { language = 'auto', signal } = {}) {
      const response = await fetchImpl('/api/voice/speak', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, language }), signal,
      })
      if (!response.ok) {
        const result = await response.json().catch(() => ({}))
        throw new Error(result.error || 'Speech synthesis failed.')
      }
      return response.blob()
    },
  }
}
