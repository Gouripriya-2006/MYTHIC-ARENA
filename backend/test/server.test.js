import test from 'node:test'
import assert from 'node:assert/strict'
import { createAppServer } from '../server.js'

function wavFile() {
  const bytes = Buffer.alloc(46)
  bytes.write('RIFF', 0)
  bytes.writeUInt32LE(38, 4)
  bytes.write('WAVE', 8)
  bytes.write('data', 36)
  bytes.writeUInt32LE(2, 40)
  return bytes
}

async function withServer(options, run) {
  const server = createAppServer({ logger: { error() {} }, ...options })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  try {
    await run(`http://127.0.0.1:${address.port}`)
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  }
}

test('health reports configuration and leaves Evon explicitly pending', async () => {
  await withServer({ env: {} }, async (base) => {
    const response = await fetch(`${base}/api/health`)
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      ok: true,
      configured: false,
      groq: { configured: false, model: 'openai/gpt-oss-20b' },
      evon: { configured: false, status: 'pending-official-api-verification' },
    })
  })
})

function groqReply(intent) {
  return Response.json({ choices: [{ message: { content: JSON.stringify(intent) } }] })
}

test('Groq interpretation returns only a backend-validated intent for either game', async () => {
  const calls = []
  await withServer({
    env: { GROQ_API_KEY: 'private-groq-test-key', GROQ_MODEL: 'mock/groq-model' },
    fetchImpl: async (url, init) => {
      calls.push({ url, init, body: JSON.parse(init.body) })
      const game = JSON.parse(init.body).messages[1].content.includes('Potion')
        ? 'babylon-3d' : 'phaser-2d'
      return groqReply(game === 'babylon-3d'
        ? { version: 1, game, action: 'use_consumable', parameters: { itemId: 'health-potion' } }
        : { version: 1, game, action: 'light_attack', parameters: {} })
    },
  }, async (base) => {
    for (const [game, transcript, expected] of [
      ['phaser-2d', 'Attack the sentinel', 'light_attack'],
      ['babylon-3d', 'Use the Health Potion', 'use_consumable'],
    ]) {
      const response = await fetch(`${base}/api/voice/interpret`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript, game }),
      })
      assert.equal(response.status, 200)
      const body = await response.json()
      assert.equal(body.intent.game, game)
      assert.equal(body.intent.action, expected)
      assert.deepEqual(Object.keys(body).sort(), ['intent'])
    }
  })
  assert.equal(calls.length, 2)
  for (const { url, init, body } of calls) {
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions')
    assert.equal(init.headers.authorization, 'Bearer private-groq-test-key')
    assert.equal(body.model, 'mock/groq-model')
    assert.deepEqual(body.response_format, { type: 'json_object' })
    assert.match(body.messages[0].content, /only allowed action names/)
  }
})

test('Groq route rejects malformed requests and reports missing configuration without key material', async () => {
  await withServer({ env: {} }, async (base) => {
    const badType = await fetch(`${base}/api/voice/interpret`, { method: 'POST', body: '{}' })
    assert.equal(badType.status, 415)
    const extraField = await fetch(`${base}/api/voice/interpret`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transcript: 'attack', game: 'phaser-2d', state: { health: 1 } }),
    })
    assert.equal(extraField.status, 400)
    const unavailable = await fetch(`${base}/api/voice/interpret`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transcript: 'attack', game: 'phaser-2d' }),
    })
    assert.equal(unavailable.status, 503)
    assert.doesNotMatch(await unavailable.text(), /GROQ_API_KEY/)
  })
})

test('Groq response parser rejects invalid JSON, unsupported actions, malformed parameters, and cross-game intents', async () => {
  const invalidResponses = [
    [Response.json({ choices: [{ message: { content: 'not-json' } }] }), 502],
    [groqReply({ version: 1, game: 'phaser-2d', action: 'teleport', parameters: {} }), 422],
    [groqReply({ version: 1, game: 'babylon-3d', action: 'use_consumable', parameters: { itemId: '../potion' } }), 422],
    [groqReply({ version: 1, game: 'babylon-3d', action: 'light_attack', parameters: { damage: 900 } }), 422],
    [groqReply({ version: 1, game: 'phaser-2d', action: 'light_attack', parameters: {} }), 422],
  ]
  let invalidIndex = 0
  await withServer({
    env: { GROQ_API_KEY: 'private-groq-test-key' },
    fetchImpl: async () => invalidResponses[invalidIndex++][0],
  }, async (base) => {
    const inputs = [
      ['attack', 'phaser-2d'], ['teleport', 'phaser-2d'], ['potion', 'babylon-3d'], ['attack', 'babylon-3d'], ['attack', 'babylon-3d'],
    ]
    for (const [index, [transcript, game]] of inputs.entries()) {
      const response = await fetch(`${base}/api/voice/interpret`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript, game }),
      })
      assert.equal(response.status, invalidResponses[index][1])
      assert.doesNotMatch(await response.text(), /private-groq-test-key/)
    }
  })
})

test('Groq maps upstream errors and timeouts to safe responses', async () => {
  for (const [upstream, expectedStatus] of [
    [new Response('rate limited', { status: 429 }), 503],
    [new Response('provider detail contains no useful public information', { status: 500 }), 502],
  ]) {
    await withServer({
      env: { GROQ_API_KEY: 'private-groq-test-key' },
      fetchImpl: async () => upstream,
    }, async (base) => {
      const response = await fetch(`${base}/api/voice/interpret`, {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ transcript: 'attack', game: 'phaser-2d' }),
      })
      assert.equal(response.status, expectedStatus)
      const body = await response.text()
      assert.doesNotMatch(body, /private-groq-test-key|provider detail/)
    })
  }
  await withServer({
    env: { GROQ_API_KEY: 'private-groq-test-key' },
    fetchImpl: async () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }) },
  }, async (base) => {
    const response = await fetch(`${base}/api/voice/interpret`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transcript: 'attack', game: 'phaser-2d' }),
    })
    assert.equal(response.status, 504)
  })
})

test('Groq provider failures log only allowlisted structured diagnostics and keep the API response sanitized', async () => {
  const logs = []
  const secret = 'private-groq-test-key'
  const transcript = 'secret transcript that must not be logged'
  await withServer({
    env: { GROQ_API_KEY: secret },
    logger: { error: (...args) => logs.push(args) },
    fetchImpl: async () => Response.json({
      error: { type: 'authentication_error', code: 'invalid_api_key', message: `bad credentials ${secret}`, request: transcript },
    }, { status: 401 }),
  }, async (base) => {
    const response = await fetch(`${base}/api/voice/interpret`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ transcript, game: 'phaser-2d' }),
    })
    assert.equal(response.status, 502)
    const publicBody = await response.text()
    assert.equal(publicBody, JSON.stringify({ error: 'Voice intent interpretation failed safely. Please try again.' }))
    assert.doesNotMatch(publicBody, /authentication_error|invalid_api_key|private-groq-test-key|secret transcript/)
  })

  assert.equal(logs.length, 1)
  assert.equal(logs[0][0], 'Groq request failed.')
  assert.deepEqual(logs[0][1], {
    event: 'groq_request_failed',
    providerHttpStatus: 401,
    error: { type: 'authentication_error', code: 'invalid_api_key' },
  })
  assert.doesNotMatch(JSON.stringify(logs), /private-groq-test-key|secret transcript|bad credentials|authorization/i)
})

test('voice intent validation accepts allowlisted proposals without invoking Evon', async () => {
  await withServer({ env: {} }, async (base) => {
    const response = await fetch(`${base}/api/voice/intent/validate`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ version: 1, game: 'babylon-3d', action: 'use_consumable', parameters: { itemId: 'health-potion' } }),
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      intent: { version: 1, game: 'babylon-3d', action: 'use_consumable', parameters: { itemId: 'health-potion' } },
    })
  })
})

test('voice intent validation rejects unsupported actions, malformed values and extra fields', async () => {
  await withServer({ env: {} }, async (base) => {
    for (const intent of [
      { version: 1, game: 'phaser-2d', action: 'heavy_attack', parameters: {} },
      { version: 1, game: 'babylon-3d', action: 'use_consumable', parameters: { itemId: '../secret' } },
      { version: 1, game: 'babylon-3d', action: 'light_attack', parameters: { damage: 999 }, coordinates: { x: 3 } },
      { version: 99, game: 'babylon-3d', action: 'light_attack', parameters: {} },
    ]) {
      const response = await fetch(`${base}/api/voice/intent/validate`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(intent),
      })
      assert.equal(response.status, 400)
      assert.equal(typeof (await response.json()).error, 'string')
    }
  })
})

test('transcription rejects unsupported content, malformed WAV and missing credentials', async () => {
  await withServer({ env: {} }, async (base) => {
    const unsupported = await fetch(`${base}/api/voice/transcribe`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}',
    })
    assert.equal(unsupported.status, 503)

    await withServer({ env: { GNANI_API_KEY: 'test-key' } }, async (configuredBase) => {
      const wrongType = await fetch(`${configuredBase}/api/voice/transcribe`, {
        method: 'POST', headers: { 'content-type': 'audio/webm' }, body: Buffer.from('recording'),
      })
      assert.equal(wrongType.status, 415)

      const malformed = await fetch(`${configuredBase}/api/voice/transcribe`, {
        method: 'POST', headers: { 'content-type': 'audio/wav' }, body: Buffer.from('not wav'),
      })
      assert.equal(malformed.status, 400)
    })
  })
})

test('transcription requests English-first Prisma v3 output and normalizes the response', async () => {
  let upstreamRequest
  await withServer({
    env: { GNANI_API_KEY: 'private-test-key' },
    fetchImpl: async (url, init) => {
      upstreamRequest = { url, init, form: init.body }
      return Response.json({ success: true, transcript: 'Find the Sun Relic', model: 'prisma-v3.0', detected_language_code: 'en-IN', request_id: 'req-1' })
    },
  }, async (base) => {
    const response = await fetch(`${base}/api/voice/transcribe`, {
      method: 'POST', headers: { 'content-type': 'audio/wav' }, body: wavFile(),
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      transcript: 'Find the Sun Relic', detectedLanguageCode: 'en-IN', requestId: 'req-1',
    })
    assert.equal(upstreamRequest.url, 'https://api.vachana.ai/stt/v3')
    assert.equal(upstreamRequest.init.headers['X-API-Key-ID'], 'private-test-key')
    assert.equal(upstreamRequest.form.get('model'), 'prisma-v3.0')
    assert.equal(upstreamRequest.form.get('language_code'), 'en-IN')
    assert.equal(upstreamRequest.form.get('format'), 'transcribe')
    assert.equal(upstreamRequest.form.get('audio_file').type, 'audio/wav')
  })
})

test('transcription preserves Malayalam text and the detected language from Prisma', async () => {
  await withServer({
    env: { GNANI_API_KEY: 'private-test-key' },
    fetchImpl: async () => Response.json({
      success: true,
      transcript: 'നമസ്കാരം, എങ്ങനെയുണ്ട്?',
      detected_language_code: 'ml-IN',
      request_id: 'req-ml',
    }),
  }, async (base) => {
    const response = await fetch(`${base}/api/voice/transcribe`, {
      method: 'POST', headers: { 'content-type': 'audio/wav' }, body: wavFile(),
    })
    assert.equal(response.status, 200)
    assert.deepEqual(await response.json(), {
      transcript: 'നമസ്കാരം, എങ്ങനെയുണ്ട്?',
      detectedLanguageCode: 'ml-IN',
      requestId: 'req-ml',
    })
  })
})

test('transcription maps upstream failures without exposing credentials', async () => {
  await withServer({
    env: { GNANI_API_KEY: 'never-return-this-secret' },
    fetchImpl: async () => new Response(JSON.stringify({ success: false, error: { message: 'upstream detail' } }), { status: 429 }),
  }, async (base) => {
    const response = await fetch(`${base}/api/voice/transcribe`, {
      method: 'POST', headers: { 'content-type': 'audio/wav' }, body: wavFile(),
    })
    assert.equal(response.status, 429)
    const body = await response.text()
    assert.match(body, /upstream detail/)
    assert.doesNotMatch(body, /never-return-this-secret/)
  })
})

test('transcription rejects recordings larger than the upload limit', async () => {
  await withServer({ env: { GNANI_API_KEY: 'test-key' } }, async (base) => {
    const response = await fetch(`${base}/api/voice/transcribe`, {
      method: 'POST', headers: { 'content-type': 'audio/wav' }, body: Buffer.alloc(8 * 1024 * 1024 + 1),
    })
    assert.equal(response.status, 413)
    assert.match((await response.json()).error, /too large/i)
  })
})

test('speech validates text and language before calling Timbre', async () => {
  let calls = 0
  await withServer({
    env: { GNANI_API_KEY: 'private-test-key' },
    fetchImpl: async () => { calls += 1; return new Response(new Uint8Array([1, 2, 3]), { headers: { 'content-type': 'audio/wav' } }) },
  }, async (base) => {
    const empty = await fetch(`${base}/api/voice/speak`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: ' ' }),
    })
    assert.equal(empty.status, 400)

    const invalidLanguage = await fetch(`${base}/api/voice/speak`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'hello', language: 'xx-XX' }),
    })
    assert.equal(invalidLanguage.status, 400)

    const tooLong = await fetch(`${base}/api/voice/speak`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'x'.repeat(1001) }),
    })
    assert.equal(tooLong.status, 413)
    assert.equal(calls, 0)
  })
})

test('speech calls Timbre v3 with configured voice and returns generated WAV bytes', async () => {
  let providerCall
  await withServer({
    env: { GNANI_API_KEY: 'private-test-key', GNANI_TIMBRE_VOICE: 'Shivani' },
    fetchImpl: async (url, init) => {
      providerCall = { url, init, body: JSON.parse(init.body) }
      return new Response(new Uint8Array([82, 73, 70, 70]), { headers: { 'content-type': 'audio/wav' } })
    },
  }, async (base) => {
    const response = await fetch(`${base}/api/voice/speak`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ text: 'Hello, hero.', language: 'en-IN' }),
    })
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('content-type'), 'audio/wav')
    assert.deepEqual([...new Uint8Array(await response.arrayBuffer())], [82, 73, 70, 70])
    assert.equal(providerCall.url, 'https://api.vachana.ai/api/v1/tts/inference')
    assert.equal(providerCall.init.headers['X-API-Key-ID'], 'private-test-key')
    assert.equal(providerCall.body.model, 'timbre-v3.0')
    assert.equal(providerCall.body.voice, 'Shivani')
    assert.equal(providerCall.body.language, 'en-IN')
    assert.equal(providerCall.body.audio_config.container, 'wav')
  })
})

test('invalid JSON and unknown routes return client errors', async () => {
  await withServer({ env: { GNANI_API_KEY: 'test' } }, async (base) => {
    const invalidJson = await fetch(`${base}/api/voice/speak`, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{',
    })
    assert.equal(invalidJson.status, 400)
    assert.equal((await invalidJson.json()).error, 'Request body must be valid JSON.')
    const missing = await fetch(`${base}/api/missing`)
    assert.equal(missing.status, 404)
  })
})
