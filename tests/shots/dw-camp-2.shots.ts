// CAMP-2 (spec/phases/design-wave-screens-b.md, "CAMP-2"): 461, a direction's header with
// "Sync {n}" and a tile's More menu open; 462, the delete-direction warning. Fake provider
// only, nothing is sent to a provider; made-up names.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import * as v from '../e2e/variants-steps'
import { closeApp, openApp, shot, type Session } from './shot'

const DIRECTION = 'Direction 1'
const TALL = '9x16 (1080×1920)'
const WIDE = '16x9 (1920×1080)'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function still(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

test('461 a direction header with Sync and the tile More menu open', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { app, page } = session
  await still(page)
  await screens.createProject(page, 'Tidewater Coffee')
  await v.createFromForm(app, page, { languages: 'en, de', sizes: [WIDE] })
  await v.fanOut(page, DIRECTION, { sizes: [TALL, WIDE] })
  await v.fanOut(page, DIRECTION, { languages: ['de'] })
  await expect(v.grid(page, DIRECTION).getByRole('listitem')).toHaveCount(4)

  // The master's headline changes: the three linked variants go out of date.
  await v.editLayer(page, v.tile(page, DIRECTION, '· master'), 'Headline')
  await v.setCopy(page, 'Slow mornings, dark roast')
  await v.showOverview(page)
  await expect(v.outOfDate(page, DIRECTION)).toHaveCount(3)
  await expect(page.getByRole('button', { name: 'Sync 3 out of date…' })).toBeVisible()

  const tall = v.tile(page, DIRECTION, '1080×1920 · en')
  await tall.getByRole('button', { name: /^More actions for / }).click()
  await expect(page.getByRole('menuitem', { name: 'Delete…' })).toBeVisible()
  await shot(page, '461-direction-header-tile-more')
})

test('462 the delete-direction warning', async () => {
  test.setTimeout(240_000)
  session = await openApp()
  const { app, page } = session
  await still(page)
  await screens.createProject(page, 'Tidewater Coffee')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await v.directionMore(page, DIRECTION, 'New direction…')
  const make = page.getByRole('dialog', { name: 'New direction' })
  await make.getByRole('textbox', { name: 'Name' }).fill('Studio')
  await make.getByRole('button', { name: 'Make direction' }).click()
  await expect(make).toBeHidden()
  await v.directionMore(page, 'Studio', 'Delete direction…')
  const warning = page.getByRole('dialog', { name: 'Delete Studio?' })
  await expect(
    warning.getByText('Its 1 variant goes with it. This cannot be undone.'),
  ).toBeVisible()
  await expect(warning.getByRole('button', { name: 'Keep' })).toBeFocused()
  await shot(page, '462-delete-direction-confirm')
})
