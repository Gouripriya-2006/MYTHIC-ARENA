/**
 * Evon integration boundary. No API call is made until Gnani publishes or
 * supplies the official conversational API contract for this use case.
 */
export function createEvonAdapter() {
  return {
    isConfigured: false,
    status: 'pending-official-api-verification',
    async interpret() {
      throw new Error('Evon is pending official API verification.')
    },
  }
}
