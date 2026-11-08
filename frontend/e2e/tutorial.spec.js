import { expect, test } from '@playwright/test'

test('new-player guide confirms live controls, provides a safe practice target, and can be replayed', async ({ page }) => {
  test.setTimeout(60_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await page.goto('/#/3d-prototype?new=1')
  const tutorial = page.locator('[data-tutorial-card]')
  await expect(tutorial).toBeVisible()
  await expect(page.locator('[data-tutorial-progress]')).toHaveText('BEGINNER GUIDE · STEP 1 OF 8')
  await expect(page.locator('[data-tutorial-title]')).toHaveText('Welcome, Wayfarer')

  await page.locator('[data-tutorial-action="next"]').click()
  await expect(page.locator('[data-tutorial-title]')).toHaveText('Move through the realm')
  const confirmations = tutorial.locator('[data-tutorial-confirmations] li')
  for (const [index, modifiers] of [[0, []], [1, ['Shift']]]) {
    for (const key of ['w', 'a', 's', 'd']) {
      for (const modifier of modifiers) await page.keyboard.down(modifier)
      await page.keyboard.down(key)
      await page.waitForTimeout(500)
      await page.keyboard.up(key)
      for (const modifier of modifiers) await page.keyboard.up(modifier)
      if ((await confirmations.nth(index).getAttribute('class'))?.includes('is-confirmed')) break
    }
  }
  await page.keyboard.down('Space')
  await page.waitForTimeout(100)
  await page.keyboard.up('Space')
  const canvas = page.locator('.prototype-canvas')
  const bounds = await canvas.boundingBox()
  await page.mouse.move(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)
  await page.mouse.down()
  await page.mouse.move(bounds.x + bounds.width / 2 + 35, bounds.y + bounds.height / 2 + 18)
  await page.mouse.up()

  await expect(tutorial.locator('[data-tutorial-confirmations] li.is-confirmed')).toHaveCount(4)
  await page.locator('[data-tutorial-action="next"]').click()
  await expect(page.locator('[data-tutorial-title]')).toHaveText('Learn to fight safely')
  await page.keyboard.press('j')
  await expect(page.locator('.rpg-toast')).toContainText('Training Warden')

  await page.locator('[data-tutorial-action="skip"]').click()
  await expect(tutorial).toBeHidden()
  await page.locator('[data-ui-action="pause"]').click()
  await page.getByRole('button', { name: 'Replay Beginner Tutorial' }).click()
  await expect(page.locator('[data-tutorial-title]')).toHaveText('Welcome, Wayfarer')
})
