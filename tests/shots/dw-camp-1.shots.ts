// CAMP-1 (spec/phases/design-wave-screens-b.md, "CAMP-1"): 459, a direction with its master,
// a running tile and the marks; 460, the sign-off popover over a tile. The running tile is a
// held run (held-run.ts): fetch in the main process never answers a request off this computer,
// the key is made up, nothing is paid. The approvals service is the stand-in on 127.0.0.1;
// the reviewer is made up, at example.com.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import * as v from '../e2e/variants-steps'
import { holdGemini, startHeldRun, firstIds } from '../e2e/held-run'
import { startApprovalsStandIn, type ApprovalsStandIn } from '../helpers/approvals-stand-in'
import * as steps from '../approvals-local/app-steps'
import { closeApp, openApp, shot, type Session } from './shot'

const DIRECTION = 'Direction 1'
const TALL = '9x16 (1080×1920)'
const WIDE = '16x9 (1920×1080)'
const KEY = 'made-up-approvals-shot-key-for-camp-1-W4QX'

let session: Session | undefined
let stand: ApprovalsStandIn | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
    await stand?.close()
    stand = undefined
  }
})

async function still(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

test('459 a direction with its master, a running tile and marks', async () => {
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

  // One held run on the tall variant: its tile shows the running mark.
  await holdGemini(app)
  const ids = await firstIds(page)
  const read = await v.campaignRead(page, ids)
  const tall = read.variants.find((row) => row.sizeLabel === '9x16' && row.language === 'en')!
  await startHeldRun(page, { ...ids, variantId: tall.id })
  await expect(v.grid(page, DIRECTION).getByRole('button', { name: 'Running' })).toBeVisible({
    timeout: 15_000,
  })
  await page.mouse.move(0, 0)
  await shot(page, '459-campaign-tiles-marks')
})

// The one link the stand-in holds, and a sign-off on its first variant at the gallery's version.
function plantSignoff(on: ApprovalsStandIn) {
  const [pair, link] = [...on.links.entries()][0] ?? []
  const first = link?.gallery[0]
  if (pair === undefined || first === undefined) throw new Error('no gallery on the stand-in')
  const [projectId = '', campaignId = ''] = pair.split('/')
  on.plantSignoff(projectId, campaignId, {
    id: 'Cm1kPq7mZt2vWx9bLn3cRd8h',
    variantKey: first.variantKey,
    version: first.version,
    email: 'reviewer@example.com',
    signedAt: new Date().toISOString(),
  })
}

test('460 the sign-off popover', async () => {
  test.setTimeout(240_000)
  stand = await startApprovalsStandIn({ key: KEY })
  session = await openApp({ ADMAN_DEV_TOOLS: '1', ADMAN_APPROVALS_TEST_PICTURES: stand.origin })
  const { app, page } = session
  await still(page)
  await steps.setUpSettings(page, stand.origin, KEY)
  await screens.createProject(page, 'Tidewater Coffee')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await steps.makeLink(page)
  plantSignoff(stand)
  await steps.refresh(page)
  const mark = steps.grid(page).getByRole('button', { name: 'Signed off by 1' })
  await mark.click()
  await expect(page.getByRole('list', { name: /^Sign-offs for / })).toBeVisible()
  await page.mouse.move(0, 0)
  await shot(page, '460-campaign-signoff-popover')
})
