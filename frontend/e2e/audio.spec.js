import { expect, test } from '@playwright/test'

async function observeWebAudio(page) {
  await page.addInitScript(() => {
    const NativeAudioContext = window.AudioContext
    window.AudioContext = class extends NativeAudioContext {
      constructor(...args) {
        super(...args)
        window.__gameAudioContext = this
      }
    }
    const oscillatorStart = OscillatorNode.prototype.start
    OscillatorNode.prototype.start = function (...args) {
      window.__audioOscillatorStarts = (window.__audioOscillatorStarts ?? 0) + 1
      return oscillatorStart.apply(this, args)
    }
  })
}

test('3D procedural audio starts after a user gesture and pause settings control saved playback', async ({ page }) => {
  test.setTimeout(60_000)
  await observeWebAudio(page)
  await page.goto('/#/3d-prototype?new=1')
  await expect(page.locator('.rpg-hud')).toBeVisible()
  await page.locator('[data-tutorial-action="skip"]').click()
  await page.waitForFunction(() => window.__gameAudioContext?.state === 'running'
    && window.__audioOscillatorStarts >= 3)
  const musicOscillators = await page.evaluate(() => window.__audioOscillatorStarts)
  await page.keyboard.press('j')
  await expect.poll(() => page.evaluate(() => window.__audioOscillatorStarts)).toBeGreaterThan(musicOscillators)

  await page.locator('[data-ui-action="pause"]').click()
  await expect(page.locator('#rpg-panel-title')).toHaveText('Realm Paused')

  const master = page.locator('[data-setting="master"]')
  await master.evaluate((input) => {
    input.value = '0.55'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect.poll(async () => page.evaluate(() => JSON.parse(
    localStorage.getItem('mythic-arena-3d-save-v1'),
  )?.settings.master)).toBe(0.55)

  await page.locator('[data-setting="muted"]').check()
  await expect.poll(async () => page.evaluate(() => JSON.parse(
    localStorage.getItem('mythic-arena-3d-save-v1'),
  )?.settings.muted)).toBe(true)
})

test('3D voice panel stays visible and handles microphone permission denial', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: { getUserMedia: async () => { throw new DOMException('Permission denied', 'NotAllowedError') } },
    })
  })
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/#/3d-prototype?new=1')
  const panel = page.locator('.rpg-hud .voice-panel')
  await expect(panel).toBeVisible()
  await expect(panel.locator('[data-voice-record]')).toBeVisible()
  await expect(panel.locator('[data-voice-transcript]')).toBeVisible()
  await expect(panel.locator('[data-voice-diagnostic="recognized-intent"]')).toBeVisible()
  await expect(panel.locator('[data-voice-diagnostic="validated-intent"]')).toBeVisible()
  await expect(panel.locator('[data-voice-diagnostic="dispatcher-result"]')).toBeVisible()
  await expect(panel.locator('[data-voice-diagnostic="last-action-status"]')).toBeVisible()
  await expect(panel.locator('[data-voice-diagnostic="rejection-reason"]')).toBeVisible()
  for (const provider of ['prisma', 'groq', 'timbre']) {
    await expect(panel.locator(`[data-voice-provider="${provider}"]`)).toBeVisible()
  }

  const bounds = await panel.boundingBox()
  const questBounds = await page.locator('.rpg-quest-card').boundingBox()
  const minimapBounds = await page.locator('.rpg-minimap').boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.y).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(1280)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(800)
  expect(bounds.y + bounds.height <= questBounds.y || questBounds.y + questBounds.height <= bounds.y
    || bounds.x + bounds.width <= questBounds.x || questBounds.x + questBounds.width <= bounds.x).toBe(true)
  expect(bounds.y + bounds.height <= minimapBounds.y || minimapBounds.y + minimapBounds.height <= bounds.y
    || bounds.x + bounds.width <= minimapBounds.x || minimapBounds.x + minimapBounds.width <= bounds.x).toBe(true)

  await panel.locator('[data-voice-record]').click()
  await expect(panel.locator('[data-voice-status]')).toHaveAttribute('data-state', 'voice-unavailable')
  await expect(panel.locator('[data-voice-detail]')).toContainText('Microphone permission was denied')
})

test('3D voice panel remains within a narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/#/3d-prototype?new=1')
  const panel = page.locator('.rpg-hud .voice-panel')
  await expect(panel).toBeVisible()
  await expect(panel.locator('[data-voice-record]')).toBeVisible()
  for (const provider of ['prisma', 'groq', 'timbre']) {
    await expect(panel.locator(`[data-voice-provider="${provider}"]`)).toBeVisible()
  }
  const bounds = await panel.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds.x).toBeGreaterThanOrEqual(0)
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(390)
  expect(bounds.y + bounds.height).toBeLessThanOrEqual(844)
  const questBounds = await page.locator('.rpg-quest-card').boundingBox()
  expect(questBounds).not.toBeNull()
  expect(bounds.y + bounds.height <= questBounds.y || questBounds.y + questBounds.height <= bounds.y
    || bounds.x + bounds.width <= questBounds.x || questBounds.x + questBounds.width <= bounds.x).toBe(true)
})

test('2D Phaser game exposes working saved audio controls and uses Web Audio after selection', async ({ page }) => {
  test.setTimeout(60_000)
  await observeWebAudio(page)
  await page.goto('/#/play')
  await page.locator('#hero-name').fill('Audio Test')
  await page.locator('.class-choice[data-class="warrior"]').click()
  await page.getByRole('button', { name: /Start adventure/ }).click()
  await expect(page.locator('.game-audio-panel')).toBeVisible()
  await expect(page.locator('#game-canvas canvas')).toBeVisible()
  await page.waitForFunction(() => window.__gameAudioContext?.state === 'running'
    && window.__audioOscillatorStarts >= 3)

  await page.locator('.game-audio-panel summary').click()
  const effects = page.locator('.game-audio-panel [data-setting="effects"]')
  await effects.evaluate((input) => {
    input.value = '0.35'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect.poll(async () => page.evaluate(() => JSON.parse(
    localStorage.getItem('mythic-arena-audio-settings-v1'),
  )?.effects)).toBe(0.35)

  const oscillatorStarts = await page.evaluate(() => window.__audioOscillatorStarts)
  await page.keyboard.press('Space')
  await expect.poll(() => page.evaluate(() => window.__audioOscillatorStarts)).toBeGreaterThan(oscillatorStarts)
})
