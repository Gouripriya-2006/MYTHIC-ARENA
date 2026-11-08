import { expect, test } from '@playwright/test'
import { createInitialProgress } from '../src/prototype3d/systems/rpgProgression.js'
import { ENEMY_ARCHETYPES } from '../src/prototype3d/systems/enemyArchetypes.js'

async function loadSavedGame(page, configure = () => {}) {
  const save = createInitialProgress({ name: 'Freeze Regression', classId: 'warrior' })
  save.objectives.briefing = true
  save.tutorial.status = 'skipped'
  configure(save)
  await page.addInitScript((state) => {
    const seedMarker = 'mythic-arena-freeze-regression-seeded'
    if (sessionStorage.getItem(seedMarker)) return
    localStorage.setItem('mythic-arena-3d-save-v1', JSON.stringify(state))
    sessionStorage.setItem(seedMarker, '1')
  }, save)
  await page.goto('/#/3d-prototype')
  await expect(page.locator('.rpg-hud')).toBeVisible()
}

async function assertSavedMovement(page, axis, direction) {
  const before = await page.evaluate(() => JSON.parse(localStorage.getItem('mythic-arena-3d-save-v1')).position)
  await page.keyboard.down(direction)
  await page.waitForTimeout(550)
  await page.keyboard.up(direction)
  await expect.poll(async () => page.evaluate((axisName) => JSON.parse(
    localStorage.getItem('mythic-arena-3d-save-v1'),
  ).position[axisName], axis), { timeout: 6_000 }).not.toBe(before[axis])
}

test('inventory potion, repeated map panels, and pause/resume leave movement responsive and saved', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await loadSavedGame(page, (save) => {
    save.health = 40
    save.position = { x: 10, y: 0, z: -7 }
  })

  await expect(page.locator('[data-health-text]')).toHaveText('40 / 120')
  await page.keyboard.press('i')
  await expect(page.locator('#rpg-panel-title')).toHaveText('Your Pack')
  await page.locator('[data-use-item="health-potion"]').click()
  await expect(page.locator('[data-health-text]')).toHaveText('100 / 120')
  await page.locator('.rpg-panel-close').click()

  for (let index = 0; index < 3; index += 1) {
    await page.keyboard.press('m')
    await expect(page.locator('#rpg-panel-title')).toHaveText('Realm Map')
    await page.keyboard.press('Escape')
    await expect(page.locator('.rpg-panel-backdrop')).toBeHidden()
  }

  await page.keyboard.press('Escape')
  await expect(page.locator('#rpg-panel-title')).toHaveText('Realm Paused')
  await page.keyboard.press('Escape')
  await expect(page.locator('.rpg-panel-backdrop')).toBeHidden()
  await assertSavedMovement(page, 'z', 'w')
  expect(pageErrors).toEqual([])

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('mythic-arena-3d-save-v1')))
  expect(saved.hero.name).toBe('Freeze Regression')
  expect(saved.health).toBe(100)
  expect(saved.inventory.find(({ id }) => id === 'health-potion').quantity).toBe(2)

  await page.reload()
  await expect(page.locator('[data-hero-name]')).toHaveText('Freeze Regression')
  await expect(page.locator('[data-health-text]')).toHaveText('100 / 120')
  const reloaded = await page.evaluate(() => JSON.parse(localStorage.getItem('mythic-arena-3d-save-v1')))
  expect(reloaded.inventory.find(({ id }) => id === 'health-potion').quantity).toBe(2)
  expect(reloaded.position.x).toBe(saved.position.x)
})

test('Escape closes Keeper dialogue and resumes keyboard movement', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await loadSavedGame(page, (save) => {
    save.position = { x: -7.2, y: 0, z: -2.2 }
    save.tutorial = { status: 'active', step: 1, confirmations: [] }
  })
  const prompt = page.locator('.rpg-interaction-prompt')
  await expect(prompt).toContainText('Speak with the Veil Keeper')
  await page.keyboard.press('e')
  await expect(page.locator('.rpg-npc-options')).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.rpg-panel-backdrop')).toBeHidden()
  await page.keyboard.down('w')
  await page.waitForTimeout(550)
  await page.keyboard.up('w')
  await expect.poll(() => page.evaluate(() => JSON.parse(
    localStorage.getItem('mythic-arena-3d-save-v1'),
  ).tutorial.confirmations)).toContain('move')
  expect(pageErrors).toEqual([])
})

test('guard and dodge input return to normal movement without wedging controller state', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await loadSavedGame(page, (save) => {
    save.position = { x: 10, y: 0, z: -7 }
    save.tutorial = { status: 'active', step: 1, confirmations: [] }
  })

  await page.keyboard.down('b')
  await page.waitForTimeout(700)
  await expect(page.locator('.rpg-toast')).toContainText('Guarding')
  await page.keyboard.up('b')
  const afterGuard = await page.locator('[data-stamina-text]').textContent()
  expect(Number.parseInt(afterGuard, 10)).toBeLessThan(110)

  await page.keyboard.down('Control')
  await page.waitForTimeout(120)
  await page.keyboard.up('Control')
  await page.keyboard.down('w')
  await page.waitForTimeout(550)
  await page.keyboard.up('w')
  await expect.poll(() => page.evaluate(() => JSON.parse(
    localStorage.getItem('mythic-arena-3d-save-v1'),
  ).tutorial.confirmations)).toContain('move')
  expect(pageErrors).toEqual([])
})

test('manual J instantly defeats the nearest unlocked boss across the map and saves the enemy state', async ({ page }) => {
  const pageErrors = []
  page.on('pageerror', (error) => pageErrors.push(error.message))
  await loadSavedGame(page, (save) => {
    save.objectives.relic = true
    save.objectives.sentinel = true
    save.enemies.sentinel.defeated = true
    for (const { id } of ENEMY_ARCHETYPES) {
      save.enemies[id].health = 0
      save.enemies[id].defeated = true
    }
    save.position = { x: 0, y: 0, z: 0 }
  })
  await expect(page.locator('[data-enemy-name]')).toHaveText('Ravana, Warden of the Veil')
  await page.keyboard.press('j')
  await expect.poll(async () => page.evaluate(() => JSON.parse(
    localStorage.getItem('mythic-arena-3d-save-v1'),
  ).enemies.boss.health)).toBe(0)
  await expect.poll(async () => page.evaluate(() => JSON.parse(
    localStorage.getItem('mythic-arena-3d-save-v1'),
  ).enemies.boss.defeated)).toBe(true)
  await expect(page.locator('[data-result-title]')).toHaveText('YOU WIN THE GAME!')
  await expect(page.locator('[data-result-subtitle]')).toHaveText('THE LOST KINGDOM HAS BEEN RESTORED.')
  await expect(page.locator('[data-result-copy]')).toHaveText('You have defeated the Warden of the Veil and restored the kingdom.')
  await expect(page.locator('.rpg-result-backdrop')).toBeVisible()
  expect(await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve(true))))).toBe(true)
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('mythic-arena-3d-save-v1')))
  expect(completed.status).toBe('victory')
  expect(completed.objectives.gate).toBe(true)
  expect(completed.objectives.boss).toBe(true)

  const savedRewards = { xp: completed.xp, gold: completed.gold }
  await page.keyboard.press('j')
  await expect(page.locator('[data-result-title]')).toHaveText('YOU WIN THE GAME!')
  expect(await page.evaluate(() => {
    const save = JSON.parse(localStorage.getItem('mythic-arena-3d-save-v1'))
    return { xp: save.xp, gold: save.gold }
  })).toEqual(savedRewards)
  await page.reload()
  await expect(page.locator('[data-result-title]')).toHaveText('YOU WIN THE GAME!')
  await expect(page.locator('.rpg-result-backdrop')).toBeVisible()
  expect(pageErrors).toEqual([])
})

test('defeating the Veil Sentinel does not show the final victory screen', async ({ page }) => {
  await loadSavedGame(page, (save) => {
    save.objectives.relic = true
    save.position = { x: 0, y: 0, z: 0 }
    for (const { id } of ENEMY_ARCHETYPES) {
      save.enemies[id].health = 0
      save.enemies[id].defeated = true
    }
  })

  await page.keyboard.press('j')
  await expect.poll(() => page.evaluate(() => JSON.parse(
    localStorage.getItem('mythic-arena-3d-save-v1'),
  ).enemies.sentinel.defeated)).toBe(true)
  await expect(page.locator('.rpg-result-backdrop')).toBeHidden()
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('mythic-arena-3d-save-v1')))
  expect(state.status).toBe('active')
  expect(state.objectives.boss).toBe(false)
  expect(state.objectives.gate).toBe(false)
})

test('defeating Ravana does not finish while another active enemy remains', async ({ page }) => {
  await loadSavedGame(page, (save) => {
    save.objectives.relic = true
    save.objectives.sentinel = true
    save.enemies.sentinel.defeated = true
    save.position = { x: 0, y: 0, z: 40 }
    for (const { id } of ENEMY_ARCHETYPES) {
      save.enemies[id].health = 0
      save.enemies[id].defeated = true
    }
    save.enemies.goblin = { ...save.enemies.goblin, health: 72, defeated: false }
  })

  await page.keyboard.press('j')
  await expect.poll(() => page.evaluate(() => JSON.parse(
    localStorage.getItem('mythic-arena-3d-save-v1'),
  ).enemies.boss.defeated)).toBe(true)
  await expect(page.locator('.rpg-result-backdrop')).toBeHidden()
  const state = await page.evaluate(() => JSON.parse(localStorage.getItem('mythic-arena-3d-save-v1')))
  expect(state.status).toBe('active')
  expect(state.enemies.goblin.defeated).toBe(false)
  expect(state.objectives.gate).toBe(false)
})

test('Return to the Realm recovers a defeated save without losing progress', async ({ page }) => {
  await loadSavedGame(page, (save) => {
    save.status = 'defeat'
    save.health = 0
    save.xp = 125
    save.level = 2
    save.objectives.relic = true
  })
  await expect(page.locator('[data-result-title]')).toHaveText('THE VEIL CLOSES')
  await page.getByRole('button', { name: /RETURN TO THE REALM/ }).click()
  await expect(page.locator('.rpg-result-backdrop')).toBeHidden()
  await expect(page.locator('[data-health-text]')).toHaveText('120 / 120')
  await expect(page.locator('.rpg-toast')).toContainText('progress is intact')
  const recovered = await page.evaluate(() => JSON.parse(localStorage.getItem('mythic-arena-3d-save-v1')))
  expect(recovered.status).toBe('active')
  expect(recovered.health).toBe(recovered.maxHealth)
  expect(recovered.xp).toBe(125)
  expect(recovered.level).toBe(2)
  expect(recovered.objectives.relic).toBe(true)

  const staminaBefore = Number((await page.locator('[data-stamina-text]').textContent()).split('/')[0].trim())
  await page.keyboard.press('j')
  await expect.poll(async () => Number((await page.locator('[data-stamina-text]').textContent()).split('/')[0].trim()))
    .toBeLessThan(staminaBefore)
})

test('New Adventure starts fresh and archives the previous saved progress', async ({ page }) => {
  const previous = createInitialProgress({ name: 'Previous Defeated Hero', classId: 'guardian' })
  previous.status = 'defeat'
  previous.health = 0
  previous.level = 3
  previous.xp = 245
  previous.objectives.relic = true
  await page.addInitScript((save) => {
    const seedMarker = 'mythic-arena-new-adventure-regression-seeded'
    if (sessionStorage.getItem(seedMarker)) return
    localStorage.setItem('mythic-arena-3d-save-v1', JSON.stringify(save))
    sessionStorage.setItem('mythic-arena-3d-hero', JSON.stringify({ name: 'Fresh Hero', classId: 'mage' }))
    sessionStorage.setItem(seedMarker, '1')
  }, previous)
  await page.goto('/#/3d-prototype?new=1')
  await expect(page.locator('[data-hero-name]')).toHaveText('Fresh Hero')
  await expect(page.locator('[data-health-text]')).toHaveText('80 / 80')
  await expect(page.locator('[data-level]')).toHaveText('LV 01')
  await expect(page.locator('.rpg-result-backdrop')).toBeHidden()
  await expect(page.locator('.rpg-toast')).toContainText('previous save was archived')
  await expect.poll(() => page.evaluate(() => window.location.hash)).toBe('#/3d-prototype')

  const archived = await page.evaluate(() => {
    const key = Object.keys(localStorage).find((entry) => entry.startsWith('mythic-arena-3d-save-v1-archive-'))
    return key ? JSON.parse(localStorage.getItem(key)) : null
  })
  expect(archived.hero.name).toBe('Previous Defeated Hero')
  expect(archived.health).toBe(0)
  expect(archived.status).toBe('defeat')
  expect(archived.xp).toBe(245)

  await page.reload()
  await expect(page.locator('[data-hero-name]')).toHaveText('Fresh Hero')
  await expect(page.locator('[data-health-text]')).toHaveText('80 / 80')
  const archiveCount = await page.evaluate(() => Object.keys(localStorage)
    .filter((entry) => entry.startsWith('mythic-arena-3d-save-v1-archive-')).length)
  expect(archiveCount).toBe(1)
})

