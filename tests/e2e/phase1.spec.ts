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

  // Window security: no Node in the page, strict CSP in place [SPEC 8.2].
  expect(await page.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe(
    'undefined',
  )
  expect(await page.evaluate(() => typeof (globalThis as { process?: unknown }).process)).toBe(
    'undefined',
  )
  const csp = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .getAttribute('content')
  expect(csp).toContain("script-src 'self'")

  // Create two projects: two tabs [FR-003].
  for (const name of ['Alpha', 'Beta']) {
    await page.getByRole('tab', { name: 'Start' }).click()
    await page.getByLabel('Project name').fill(name)
    await page.getByRole('button', { name: 'Create project' }).click()
    await expect(page.getByRole('heading', { name })).toBeVisible()
  }
  await expect(page.getByRole('tablist', { name: 'Open projects' }).getByRole('tab')).toHaveText([
    'Start',
    'Alpha',
    'Beta',
  ])
  expect(fs.existsSync(path.join(box.projects, 'Alpha.adman'))).toBe(true)

  // A saved key shows only its last four characters [R-10].
  await page.getByRole('button', { name: 'Settings' }).click()
  const row = page.getByRole('group', { name: 'Google Gemini API key' })
  await row.getByRole('button', { name: 'Add' }).click()
  await row.getByLabel('New Google Gemini API key').fill('e2e-secret-key-WXYZ')
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.getByText('Saved, ends in WXYZ')).toBeVisible()
  expect(await page.content()).not.toContain('e2e-secret-key-WXYZ')
  await app.close()

  // Closed project files release their lock; a file passed on the command line opens,
  // which is how Windows delivers a double-clicked file [R-06].
  const again = await launch(box, [path.join(box.projects, 'Alpha.adman')])
  const page2 = await again.firstWindow()
  await expect(page2.getByRole('heading', { name: 'Alpha' })).toBeVisible()
  await expect(page2.getByRole('tab', { name: 'Alpha' })).toHaveAttribute('aria-selected', 'true')
  await page2.getByRole('tab', { name: 'Start' }).click()
  await expect(page2.getByRole('button', { name: /^Open Beta/ })).toBeVisible()
  await again.close()

  const secrets = fs.readFileSync(path.join(box.userData, 'secrets.bin'))
  expect(secrets.toString('latin1')).not.toContain('e2e-secret-key-WXYZ')
})
