// ED-2 (spec/phases/design-wave-screens-a.md, "Text layer"): the text layer's properties.
// 425: "Call to action" on an image post, as the layout made it: Copy with "Suggest copy…" in
// its corner, Type open with its summary and the built-in style chips, Box folded. 426: a ja
// post's translated Headline on a project with no fonts: the Proposed mark and Approve under
// Copy, "All ja posts", Box open. The fake text provider makes the translations (no paid call).
import { test, expect, type Page } from '@playwright/test'
import path from 'node:path'
import * as screens from '../e2e/screens'
import * as l from '../e2e/localize-steps'
import * as v from '../e2e/variants-steps'
import { closeApp, openApp, shot, type Session } from './shot'

const BRIEF = path.resolve('tests/shots/fixtures/s2-16-brief.yaml')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

// A still window: reduce motion and a fixed Math.random before the page draws.
async function still(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

const properties = (page: Page) => page.getByRole('region', { name: 'Properties' })

test('A text layer on an image post, as made', async () => {
  session = await openApp()
  const { app, page } = session
  await still(page)
  await screens.createProject(page, 'Alpine Spring')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  await page
    .getByRole('region', { name: 'New campaign' })
    .getByRole('button', { name: 'Create campaign' })
    .click()
  await page.getByRole('list', { name: 'Variants' }).getByRole('button').first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page
    .getByRole('list', { name: 'Layers' })
    .getByRole('button', { name: /^Call to action/ })
    .first()
    .click()
  const panel = properties(page)
  await expect(panel.getByRole('button', { name: 'Suggest copy…' })).toBeVisible()
  await expect(panel.getByRole('group', { name: 'Built-in styles' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Box' })).toHaveAttribute('aria-expanded', 'false')
  await page.waitForTimeout(500)
  await shot(page, '425-text-layer-defaults')
})

test('A translated text layer on a project with no fonts, Box open', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { app, page } = session
  await still(page)
  await l.localise(app, page, 'Lantern Bay')
  await v.editLayer(page, v.tile(page, l.DIRECTION, '1080×1080 · ja'), 'Headline')
  const panel = properties(page)
  await expect(panel.getByTitle('Translation: Proposed, from AI')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Approve' })).toBeVisible()
  await expect(panel.getByRole('button', { name: 'All ja posts', exact: true })).toBeVisible()
  await expect(panel.getByRole('group', { name: 'Built-in styles' })).toBeVisible()
  const box = panel.getByRole('button', { name: 'Box' })
  if ((await box.getAttribute('aria-expanded')) === 'false') await box.click()
  await panel.getByRole('group', { name: 'Box colour' }).scrollIntoViewIfNeeded()
  await page.waitForTimeout(500)
  await shot(page, '426-text-layer-translated-box-open')
})
