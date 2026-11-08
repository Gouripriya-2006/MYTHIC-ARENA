import { expect, test } from '@playwright/test'

test('Lost Kingdom Phaser scene initializes its world without runtime errors', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await page.goto('/')

  const result = await page.evaluate(async () => {
    const [{ createGame }, { createGameStore }, { lostKingdom }] = await Promise.all([
      import('/src/game/createGame.js'),
      import('/src/game/state/gameStore.js'),
      import('/src/game/data/missions/lostKingdom.js'),
    ])
    const host = document.createElement('div')
    host.style.width = '960px'
    host.style.height = '540px'
    document.body.append(host)
    const store = createGameStore({ classId: 'warrior', name: 'Render Check' })
    const game = createGame(host, store, () => {}, { play() {} })
    await new Promise((resolve) => setTimeout(resolve, 250))
    const scene = game.scene.getScene('LostKingdomScene')
    const result = {
      active: scene.scene.isActive(),
      hasPlayer: Boolean(scene.player),
      hasSentinel: Boolean(scene.sentinel),
      hasCanvas: Boolean(host.querySelector('canvas')),
      interactionUnavailableAtStart: !scene.canExecuteVoiceAction('interact_nearest'),
    }
    scene.player.setPosition(lostKingdom.relic.x, lostKingdom.relic.y)
    result.interactionAvailableNearRelic = scene.canExecuteVoiceAction('interact_nearest')
    result.interactionExecuted = scene.executeVoiceAction('interact_nearest')
    result.relicObjectiveCompleted = store.getState().objectives.relic
    result.interactionUnavailableAfterRelic = !scene.canExecuteVoiceAction('interact_nearest')
    game.destroy(true)
    host.remove()
    return result
  })

  expect(result).toEqual({
    active: true,
    hasPlayer: true,
    hasSentinel: true,
    hasCanvas: true,
    interactionUnavailableAtStart: true,
    interactionAvailableNearRelic: true,
    interactionExecuted: true,
    relicObjectiveCompleted: true,
    interactionUnavailableAfterRelic: true,
  })
  expect(pageErrors).toEqual([])
})

test('Phaser voice dispatcher reaches the real LostKingdomScene attack handler and rejects invalid state', async ({ page }) => {
  await page.goto('/#/play')
  const result = await page.evaluate(async () => {
    const [{ LostKingdomScene }, { createPhaserVoiceActionDispatcher }, { createGameStore }] = await Promise.all([
      import('/src/game/scenes/LostKingdomScene.js'),
      import('/src/game/ai/voiceActionDispatcher.js'),
      import('/src/game/state/gameStore.js'),
    ])
    const gameStore = createGameStore({ classId: 'warrior', name: 'Voice Test' })
    gameStore.recoverRelic()
    let overrideStatus
    const store = {
      getState: () => overrideStatus
        ? { ...gameStore.getState(), status: overrideStatus }
        : gameStore.getState(),
      attackSentinel: () => gameStore.attackSentinel(),
      defeatSentinel: () => gameStore.defeatSentinel(),
    }
    const scene = Object.create(LostKingdomScene.prototype)
    scene.store = store
    scene.player = { x: 100, y: 100 }
    scene.sentinel = { x: 658, y: 280, setVisible() {} }
    scene.lastAttack = 580
    scene.time = { now: 1000, delayedCall() {} }
    scene.audio = { play() {} }
    scene.sentinelBody = { setAlpha() {} }
    scene.sentinelAura = { destroy() {} }
    scene.sentinelLabel = { setVisible() {} }
    scene.onMessage = () => {}
    scene.cameras = { main: { shake() {} } }
    const dispatcher = createPhaserVoiceActionDispatcher(scene)
    const intent = { version: 1, game: 'phaser-2d', action: 'light_attack', parameters: {} }
    const before = store.getState().sentinelHealth
    scene.lastAttack = 900
    const cooldownRejection = dispatcher.dispatch(intent)
    scene.lastAttack = 580
    const successfulAttack = dispatcher.dispatch(intent)
    const afterAttack = store.getState().sentinelHealth
    const noEnemyRejection = dispatcher.dispatch(intent)
    overrideStatus = 'defeat'
    const missionRejection = dispatcher.dispatch(intent)
    return { before, afterAttack, successfulAttack, cooldownRejection, noEnemyRejection, missionRejection }
  })

  expect(result.successfulAttack.ok).toBe(true)
  expect(result.afterAttack).toBe(0)
  expect(result.successfulAttack.intent.action).toBe('light_attack')
  expect(result.cooldownRejection.ok).toBe(false)
  expect(result.noEnemyRejection.ok).toBe(false)
  expect(result.noEnemyRejection.error).toBe('No active enemies found.')
  expect(result.missionRejection.ok).toBe(false)
})

test('Phaser keyboard J defeats the active Sentinel across the map', async ({ page }) => {
  await page.goto('/')
  await page.evaluate(async () => {
    const [{ createGame }, { createGameStore }] = await Promise.all([
      import('/src/game/createGame.js'),
      import('/src/game/state/gameStore.js'),
    ])
    const host = document.createElement('div')
    host.style.width = '960px'
    host.style.height = '540px'
    document.body.append(host)
    const store = createGameStore({ classId: 'warrior', name: 'J Key Test' })
    store.recoverRelic()
    const game = createGame(host, store, () => {}, { play() {} })
    await new Promise((resolve) => setTimeout(resolve, 250))
    const scene = game.scene.getScene('LostKingdomScene')
    scene.player.setPosition(200, 100)
    window.__phaserJTest = { game, host, store }
  })

  await page.keyboard.press('j')
  await expect.poll(() => page.evaluate(() => window.__phaserJTest.store.getState().sentinelHealth)).toBe(0)
  const state = await page.evaluate(() => window.__phaserJTest.store.getState())
  expect(state.objectives.sentinel).toBe(true)
  expect(state.status).toBe('active')
  await page.evaluate(() => {
    window.__phaserJTest.game.destroy(true)
    window.__phaserJTest.host.remove()
    delete window.__phaserJTest
  })
})
