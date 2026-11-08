export function createReasoningPort({ interpretIntent } = {}) {
  return {
    isConfigured: typeof interpretIntent === 'function',
    async interpretIntent(input) {
      if (typeof interpretIntent !== 'function') {
        throw new Error('AI reasoning is not configured.')
      }
      return interpretIntent(input)
    },
  }
}
