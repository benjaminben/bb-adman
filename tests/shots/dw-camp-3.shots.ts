// CAMP-3 (spec/phases/design-wave-screens-b.md, "CAMP-3"): 463, the campaign head and the one
// tab strip with two variant tabs and a live approval link; 464, a refresh failure shown on the
// page. The approvals service is the local stand-in, the pictures go to its test store; the
// fake provider only, nothing is sent out; made-up names and keys.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import * as v from '../e2e/variants-steps'
import * as steps from '../approvals-local/app-steps'
import { startApprovalsStandIn, type ApprovalsStandIn } from '../helpers/approvals-stand-in'
import { closeApp, openApp, shot, type Session } from './shot'

const KEY = 'made-up-approvals-shots-key-camp-3-Q4TX'
const DIRECTION = 'Direction 1'
const TALL = '9x16 (1080×1920)'

let session: Session | undefined
let stand: ApprovalsStandIn | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
  await stand?.close().catch(() => {})
  stand = undefined
})

async function still(page: Page) {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

// A campaign of two variants with a live link, one of them signed off; both open in tabs.
async function campaignWithLink(): Promise<Page> {
  stand = await startApprovalsStandIn({ key: KEY })
  session = await openApp({ ADMAN_DEV_TOOLS: '1', ADMAN_APPROVALS_TEST_PICTURES: stand.origin })
  const { app, page } = session
  await still(page)
  await steps.setUpSettings(page, stand.origin, KEY)
  await screens.createProject(page, 'Harbour Lights')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await v.fanOut(page, DIRECTION, { sizes: [TALL] })
  await expect(v.grid(page, DIRECTION).getByRole('listitem')).toHaveCount(2)
  await steps.makeLink(page)
  const [pair, link] = [...stand.links.entries()][0] ?? []
  const first = link?.gallery[0]
  if (pair === undefined || first === undefined) throw new Error('no gallery on the stand-in')
  const [projectId = '', campaignId = ''] = pair.split('/')
  stand.plantSignoff(projectId, campaignId, {
    id: 'Camp3kPq7mZt2vWx9bLn3cRd',
    variantKey: first.variantKey,
    version: first.version,
    email: 'reviewer@example.com',
    signedAt: new Date().toISOString(),
  })
  await steps.refresh(page)
  const tiles = v.grid(page, DIRECTION).getByRole('listitem')
  for (const n of [0, 1]) await v.tileButton(tiles.nth(n)).click({ modifiers: ['ControlOrMeta'] })
  await expect(
    page.getByRole('tablist', { name: 'Campaign', exact: true }).getByRole('tab'),
  ).toHaveCount(5)
  return page
}

test('463 the campaign head and the one tab strip with two variant tabs and a live link', async () => {
  test.setTimeout(300_000)
  const page = await campaignWithLink()
  await expect(page.getByRole('button', { name: /^Approval link… \d\/2$/ })).toBeVisible()
  await shot(page, '463-campaign-head-one-strip')
})

test('464 a refresh failure shown on the page', async () => {
  test.setTimeout(300_000)
  const page = await campaignWithLink()
  stand?.once('getLink', { status: 500 })
  await steps.bar(page).getByRole('button', { name: 'Refresh' }).click()
  await expect(steps.bar(page).getByRole('button', { name: 'Refresh' })).toBeEnabled()
  await expect(steps.bar(page).locator('span').last()).toBeVisible()
  await shot(page, '464-campaign-refresh-failure')
})
