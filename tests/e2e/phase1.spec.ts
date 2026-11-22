import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

test('Phase 1: create, reopen from the command line, tabs, keys', async () => {
  const app = await launch(box)
  const page = await app.firstWindow()

  // Window security: no Node in the page [SPEC 8.2]. The policy is checked by csp.spec.ts.
  expect(await page.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe(
    'undefined',
  )
  expect(await page.evaluate(() => typeof (globalThis as { process?: unknown }).process)).toBe(
    'undefined',
  )

  // Create two projects: two tabs [FR-003].
  for (const name of ['Alpha', 'Beta']) {
    await page.locator('header button[aria-haspopup="menu"]').click()
    await page.getByRole('menuitem', { name: 'Start screen' }).click()
    await page.getByLabel('Project name').fill(name)
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page.getByRole('heading', { name })).toBeVisible()
  }
  await page.locator('header button[aria-haspopup="menu"]').click()
  const items = page.getByRole('menu').getByRole('menuitem')
  const names = ['Alpha', 'Close Alpha', 'Beta', 'Close Beta', 'Package…', 'Open…', 'Start screen']
  await expect(items).toHaveCount(names.length)
  for (const [i, name] of names.entries()) await expect(items.nth(i)).toHaveAccessibleName(name)
  await page.keyboard.press('Escape')
  expect(fs.existsSync(path.join(box.projects, 'Alpha.adman'))).toBe(true)

  // A saved key shows only its last four characters [R-10].
  await page.getByRole('button', { name: 'Settings' }).click()
  const row = page.getByRole('group', { name: 'Google Gemini API key' })
  await row.getByRole('button', { name: 'Add key' }).click()
  await row.getByLabel('New Google Gemini API key').fill('e2e-secret-key-WXYZ')
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.getByText('•••WXYZ')).toBeVisible()
  expect(await page.content()).not.toContain('e2e-secret-key-WXYZ')
  await app.close()

  // Closed project files release their lock; a file passed on the command line opens,
  // which is how Windows delivers a double-clicked file [R-06].
  const again = await launch(box, [path.join(box.projects, 'Alpha.adman')])
  const page2 = await again.firstWindow()
  await expect(page2.getByRole('heading', { name: 'Alpha' })).toBeVisible()
  await expect(page2.getByRole('button', { name: 'Alpha', exact: true })).toHaveAttribute(
    'aria-haspopup',
    'menu',
  )
  await page2.locator('header button[aria-haspopup="menu"]').click()
  await page2.getByRole('menuitem', { name: 'Start screen' }).click()
  await expect(page2.getByRole('button', { name: /^Open Beta/ })).toBeVisible()
  await again.close()

  const secrets = fs.readFileSync(path.join(box.userData, 'secrets.bin'))
  expect(secrets.toString('latin1')).not.toContain('e2e-secret-key-WXYZ')
})
