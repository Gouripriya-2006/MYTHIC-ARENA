import { expect, test } from '@playwright/test'

test('approaching the live Keeper and pressing E tracks The Keeper’s Charge', async ({ page }) => {
  const diagnostics = []
  page.on('console', (message) => {
    const text = message.text()
    if (!text.startsWith('[Interaction diagnostics] ')) return
    diagnostics.push(JSON.parse(text.slice('[Interaction diagnostics] '.length)))
  })

  await page.goto('/#/3d-prototype?new=1')
  await expect(page.locator('.rpg-hud')).toBeVisible()
  await page.waitForTimeout(500)

  const skipCinematic = page.locator('[data-ui-action="skip-cinematic"]')
  if (await skipCinematic.isVisible()) await skipCinematic.click()

  await page.keyboard.down('a')
  await page.waitForTimeout(800)
  await page.keyboard.up('a')
  await page.keyboard.down('w')
  await page.waitForTimeout(450)
  await page.keyboard.up('w')

  const keeperPrompt = page.locator('.rpg-interaction-prompt')
  await expect(keeperPrompt).toContainText('Speak with the Veil Keeper')
  await page.keyboard.press('e')

  await expect(page.locator('[data-tracked-name]')).toHaveText('The Keeper’s Charge')
  await expect(page.locator('[data-tracked-subtitle]')).toContainText('last guardian of the kingdom')
  await expect(page.locator('.rpg-toast')).toContainText('I am the last voice of this kingdom')
  expect(diagnostics).toHaveLength(1)
  expect(diagnostics[0].keeperRegistered).toBe(true)
  expect(diagnostics[0].keeperRootName).toBe('veil-keeper-npc')
  expect(diagnostics[0].selectedTarget).toBe('keeper')
  expect(diagnostics[0].candidates.find(({ id }) => id === 'keeper').inRange).toBe(true)
  console.log('Keeper interaction runtime diagnostics:', JSON.stringify(diagnostics[0]))
})
