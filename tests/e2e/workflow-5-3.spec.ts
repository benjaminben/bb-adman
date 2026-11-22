// P5-19, Phase 5 exit criterion 1: workflow 5.3 (keep the variants in step with the master) end
// to end in the built app with ADMAN_FAKE_PROVIDERS=1. A campaign from the brief form in two
// languages and three sizes; fan-out to two more sizes, then one more language; an override on
// one variant; a master edit; the sync review with "Accept selected", then "Accept all" with
// "Keep mine". No paid call and no request leaves the computer. Made-up names only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import * as screens from './screens'
import { makeSandbox, launch, type Sandbox } from './launch'
import { placeOf } from './workflow-5-1-steps'
import * as v from './variants-steps'

const DIRECTION = 'Direction 1'
const TALL = '9x16 (1080×1920)'
const WIDE = '16x9 (1920×1080)'
const OWN = '#C2185B'
const MASTER = '#1F6FEB'
const COPY = 'Every sip, a cool breeze'

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await app.firstWindow()
})
test.afterEach(async () => {
  try {
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

test('Workflow 5.3: a master edit, the sync review, Accept selected, then Accept all', async () => {
  test.setTimeout(180_000)
  await screens.createProject(page, 'Meadow')
  await v.createFromForm(app, page, { languages: 'en, de', sizes: [WIDE] })
  const place = await placeOf(page, screens.E2E_CAMPAIGN)

  // Fan-out: two more sizes in the master's language, then one more language at the master's.
  await v.fanOut(page, DIRECTION, { sizes: [TALL, WIDE] })
  await expect(v.grid(page, DIRECTION).getByRole('listitem')).toHaveCount(3)
  await v.fanOut(page, DIRECTION, { languages: ['de'] })
  await expect(v.grid(page, DIRECTION).getByRole('listitem')).toHaveCount(4)
  await expect(v.section(page, DIRECTION).getByText('4 variants')).toBeVisible()
  await expect(
    v.section(page, DIRECTION).getByRole('button', { name: /^Sync \d+ out of date…$/ }),
  ).toHaveCount(0)

  // The tall variant's headline colour changed by hand first: an override.
  await v.editLayer(page, v.tile(page, DIRECTION, '1080×1920 · en'), 'Headline')
  await v.setColour(page, OWN)
  await v.showOverview(page)

  // The master's headline colour and copy; the three linked variants go out of date.
  await v.editLayer(page, v.tile(page, DIRECTION, '· master'), 'Headline')
  await v.setColour(page, MASTER)
  await v.setCopy(page, COPY)
  await v.showOverview(page)
  await expect(v.outOfDate(page, DIRECTION)).toHaveCount(3)
  for (const line of ['1080×1920 · en', '1920×1080 · en', '1080×1080 · de'])
    await expect(
      v.tile(page, DIRECTION, line).getByTitle('Out of date', { exact: true }),
    ).toBeVisible()

  // The review lists each and flags the override; one variant's change, "Accept selected".
  const review = await v.openSyncReview(page, DIRECTION, 3)
  for (const heading of [/· 9x16 · en$/, /· 16x9 · en$/, /· 1x1 · de$/])
    await expect(review.getByRole('listitem', { name: heading })).toBeVisible()
  const flag = 'Changed on this variant: style: colour'
  await review.getByRole('button', { name: /· 9x16 · en$/ }).click()
  await expect(
    v.changesOf(review, /· 9x16 · en$/).getByRole('radiogroup', { name: flag }),
  ).toBeVisible()
  await expect(review.getByRole('radiogroup', { name: flag })).toHaveCount(1)
  await v.acceptSelected(review, /· 16x9 · en$/)

  // The unticked ones stay out of date.
  await expect(v.outOfDate(page, DIRECTION)).toHaveCount(2)
  await expect(
    v.tile(page, DIRECTION, '1920×1080 · en').getByTitle('Out of date', { exact: true }),
  ).toHaveCount(0)

  // "Accept all" clears the rest, "Keep mine" left on for the flagged colour.
  const rest = await v.openSyncReview(page, DIRECTION, 2)
  await rest.getByRole('button', { name: /· 9x16 · en$/ }).click()
  const choice = rest.getByRole('radiogroup', { name: flag })
  await expect(choice.getByRole('radio', { name: 'Keep mine' })).toBeChecked()
  await rest.getByRole('button', { name: 'Accept all' }).click()
  await expect(rest).toBeHidden()
  await expect(v.outOfDate(page, DIRECTION)).toHaveCount(0)
  await expect(
    v.section(page, DIRECTION).getByRole('button', { name: /^Sync \d+ out of date…$/ }),
  ).toHaveCount(0)

  // The flagged variant kept its colour and took the copy; the other took both.
  const { variants } = await v.campaignRead(page, place)
  const id = (size: string, language: string) =>
    variants.find((r) => r.sizeLabel === size && r.language === language)!.id
  const tall = await v.layerOf(page, place.projectId, id('9x16', 'en'), 'headline')
  expect(tall?.style.color).toBe(OWN)
  expect(tall?.copy).toBe(COPY)
  const wide = await v.layerOf(page, place.projectId, id('16x9', 'en'), 'headline')
  expect(wide?.style.color).toBe(MASTER)
  expect(wide?.copy).toBe(COPY)
})
