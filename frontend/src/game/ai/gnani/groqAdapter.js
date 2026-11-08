export function createGroqAdapter({ fetchImpl = globalThis.fetch } = {}) {
  return {
    async interpret(transcript, game, { signal } = {}) {
      const response = await fetchImpl('/api/voice/interpret', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, game }),
        signal,
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(body.error || 'Groq could not interpret this voice command.')
      if (!body.intent || typeof body.intent !== 'object') {
        throw new Error('Groq returned no validated game intent.')
      }
      return body
    },
  }
}
