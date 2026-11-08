import { expect, test } from '@playwright/test'
import { createInitialProgress } from '../src/prototype3d/systems/rpgProgression.js'

test('the existing Ravana encounter loads its phase-three health and visible Shadow Dash warning', async ({ page }) => {
  test.setTimeout(60_000)
  const savedProgress = createInitialProgress({ classId: 'warrior' })
  savedProgress.position = { x: 0, y: 0, z: 37.5 }
  savedProgress.objectives.briefing = true
  savedProgress.objectives.relic = true
  savedProgress.objectives.sentinel = true
  savedProgress.enemies.sentinel.defeated = true
  savedProgress.enemies.boss.health = 100
  savedProgress.enemies.boss.phase = 3
  savedProgress.tutorial.status = 'skipped'
  await page.addInitScript((state) => {
    localStorage.setItem('mythic-arena-3d-save-v1', JSON.stringify(state))
  }, savedProgress)
  await page.goto('/#/3d-prototype')
  await expect(page.locator('.rpg-hud')).toBeVisible()

  const phase = page.locator('[data-boss-phase]')
  await expect(phase).toBeVisible()
  await expect(phase).toHaveText('PHASE III / III')
  await expect(page.locator('[data-enemy-name]')).toHaveText('Ravana, Warden of the Veil')
  await expect(page.locator('[data-boss-warning]')).toBeVisible({ timeout: 15_000 })
  await expect(page.locator('[data-boss-warning]')).toContainText('Shadow Dash')
  await expect(page.locator('.rpg-toast')).toContainText('Shadow Dash!')
  await expect(page.locator('[data-health-text]')).not.toHaveText('120 / 120', { timeout: 10_000 })
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('mythic-arena-3d-save-v1')))
  expect(persisted.health).toBeLessThan(120)
})
