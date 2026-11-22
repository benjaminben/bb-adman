// R2E-10 (spec/phases/round-2-editor.md D8): a new user meets the first-run setup once. A
// sandbox without the mark shows it; "Skip for now" closes it; the next launch does not.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
  fs.writeFileSync(
    path.join(box.userData, 'settings.json'),
    JSON.stringify({ defaultProjectDir: box.projects }),
  )
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

test('the first-run setup shows once, and Skip for now keeps it away', async () => {
  const first = await launch(box)
  const page = await first.firstWindow()
  const setup = page.getByRole('dialog', { name: 'Set up AdManager' })
  await expect(setup).toBeVisible()
  await page.getByRole('button', { name: 'Skip for now' }).click()
  await expect(setup).toBeHidden()
  await expect
    .poll(() => {
      const saved = JSON.parse(fs.readFileSync(path.join(box.userData, 'settings.json'), 'utf8'))
      return (saved as { setup?: { done?: boolean } }).setup?.done
    })
    .toBe(true)
  await first.close()

  const second = await launch(box)
  const again = await second.firstWindow()
  await expect(again.getByRole('heading', { name: 'Adman', level: 1 })).toBeVisible()
  // The rule is decided once the app state arrives; give it that moment before looking.
  await again.waitForTimeout(1000)
  await expect(again.getByRole('dialog', { name: 'Set up AdManager' })).toHaveCount(0)
  await second.close()
})
