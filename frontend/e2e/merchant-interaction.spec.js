import { expect, test } from '@playwright/test'
import { createInitialProgress } from '../src/prototype3d/systems/rpgProgression.js'

test('Lyra opens the live merchant, confirms sales, and updates gold and stock after a purchase', async ({ page }) => {
  test.setTimeout(60_000)
  const diagnostics = []
  page.on('console', (message) => {
    if (message.text().startsWith('[Interaction diagnostics] ')) {
      diagnostics.push(JSON.parse(message.text().slice('[Interaction diagnostics] '.length)))
    }
  })

  const savedProgress = createInitialProgress({ classId: 'warrior' })
  savedProgress.position = { x: -8.5, y: 0, z: -7.5 }
  savedProgress.objectives.briefing = true
  savedProgress.tutorial.status = 'skipped'
  await page.addInitScript((state) => {
    localStorage.setItem('mythic-arena-3d-save-v1', JSON.stringify(state))
  }, savedProgress)
  await page.goto('/#/3d-prototype')
  await expect(page.locator('.rpg-hud')).toBeVisible()
  await expect(page.locator('.rpg-interaction-prompt')).toContainText('Speak with Lyra Thornbloom')
  await page.keyboard.press('e')
  await expect(page.locator('.rpg-npc-options')).toBeVisible()
  expect(diagnostics).toHaveLength(1)
  expect(diagnostics[0].selectedTarget).toBe('apothecary')
  expect(diagnostics[0].candidates.find(({ id }) => id === 'apothecary').inRange).toBe(true)
  await page.getByRole('button', { name: 'Browse remedies and rations' }).click()
  await expect(page.locator('#rpg-panel-title')).toHaveText('Lyra Thornbloom')

  await page.locator('[data-shop-tab="sell"]').click()
  for (let count = 0; count < 3; count += 1) {
    await page.locator('[data-sell-item="health-potion"]').click()
    await page.locator('[data-confirm-sale]').click()
  }
  await page.locator('[data-sell-item="mana-potion"]').click()
  await page.locator('[data-confirm-sale]').click()

  await page.locator('[data-shop-tab="buy"]').click()
  await expect(page.locator('[data-shop-gold]')).toHaveText('20 ✦')
  await expect(page.locator('.rpg-merchant-item').filter({ has: page.locator('[data-buy-item="health-potion"]') }))
    .toContainText('STOCK 15')
  await page.locator('[data-buy-item="health-potion"]').click()
  await expect(page.locator('[data-shop-gold]')).toHaveText('8 ✦')
  await expect(page.locator('.rpg-merchant-item').filter({ has: page.locator('[data-buy-item="health-potion"]') }))
    .toContainText('STOCK 14')
  await expect(page.locator('.rpg-toast')).toContainText('Purchased Health Potion for 12 gold.')

  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem('mythic-arena-3d-save-v1')))
  expect(persisted.gold).toBe(8)
  expect(persisted.merchantStock.apothecary['health-potion']).toBe(14)
  expect(persisted.inventory.find(({ id }) => id === 'health-potion').quantity).toBe(1)
})
