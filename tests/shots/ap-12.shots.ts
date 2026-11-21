// AP-12: the tile marks and a tile's sign-off list, against the approvals stand-in on 127.0.0.1
// and the test picture store (dev tools on). The service, a made-up bucket and made-up keys are
// saved through Settings; the e2e brief makes the campaign (one variant). Two sign-offs are
// planted in the stand-in, at example.com: one for the variant's version in the gallery, one for
// an earlier version. Nothing leaves this machine.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { startApprovalsStandIn, type ApprovalsStandIn } from '../helpers/approvals-stand-in'
import { closeApp, openApp, shot, type Session } from './shot'

// Made up for these pictures; the stand-in is told to accept the key.
const KEY = 'made-up-approvals-shot-key-T3MK'

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

async function saveKey(page: Page, box: string, label: string, value: string) {
  const row = page.getByRole('region', { name: box }).getByRole('group', { name: label })
  await row.getByRole('button', { name: 'Add' }).click()
  await row.getByLabel(`New ${label}`).fill(value)
  await row.getByRole('button', { name: 'Save' }).click()
  await expect(row.getByText(/Saved, ends in/)).toBeVisible()
}

async function setUpSettings(page: Page, origin: string) {
  await screens.openSettings(page)
  const s3 = page.getByRole('region', { name: 'Cloud storage' })
  await s3.getByLabel('Bucket', { exact: true }).fill('made-up-adman-pictures')
  await s3.getByLabel('Region', { exact: true }).fill('eu-west-1')
  await s3.getByRole('button', { name: 'Save', exact: true }).click()
  await saveKey(page, 'Cloud storage', 'Amazon S3 Access key ID', 'MADEUPKEYIDQ7RT')
  await saveKey(page, 'Cloud storage', 'Amazon S3 Secret access key', 'made-up-secret-key-0001')
  const box = page.getByRole('region', { name: 'Approvals service' })
  await box.getByLabel('Service address').fill(origin)
  await box.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(box.getByRole('button', { name: 'Remove' })).toBeVisible()
  await saveKey(page, 'Approvals service', 'Service API key', KEY)
}

// A current sign-off on the first variant in the gallery and an earlier-version one beside it.
function plantSignoffs(on: ApprovalsStandIn) {
  const [pair, link] = [...on.links.entries()][0] ?? []
  const first = link?.gallery[0]
  if (pair === undefined || first === undefined) throw new Error('no gallery on the stand-in')
  const [projectId = '', campaignId = ''] = pair.split('/')
  const signedAt = new Date().toISOString()
  on.plantSignoff(projectId, campaignId, {
    id: 'Tm5kPq7mZt2vWx9bLn3cRd8h',
    variantKey: first.variantKey,
    version: first.version,
    email: 'reviewer@example.com',
    signedAt,
  })
  // An hour earlier, so the list shows it second.
  on.plantSignoff(projectId, campaignId, {
    id: 'Tm6kPq7mZt2vWx9bLn3cRd8j',
    variantKey: first.variantKey,
    // A new variant is at rev 0, so no lower version exists. Any version other than the one in
    // the gallery is drawn the same way, "for an earlier version".
    version: first.version + 1,
    email: 'second.reviewer@example.com',
    signedAt: new Date(Date.now() - 3_600_000).toISOString(),
  })
}

test('Tile marks and the sign-off list', async () => {
  test.setTimeout(180_000)
  stand = await startApprovalsStandIn({ key: KEY })
  session = await openApp({ ADMAN_DEV_TOOLS: '1', ADMAN_APPROVALS_TEST_PICTURES: stand.origin })
  const { app, page } = session
  await setUpSettings(page, stand.origin)
  await screens.createProject(page, 'Tile Marks Shots')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)

  await page.getByRole('button', { name: 'Approval link…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Approval link' })
  await dialog.getByRole('button', { name: 'Make link' }).click()
  await expect(dialog.getByText(/^Updated /)).toBeVisible({ timeout: 60_000 })
  plantSignoffs(stand)
  await dialog.getByRole('button', { name: 'Close' }).click()

  const bar = page.getByRole('group', { name: 'Approval link' })
  await bar.getByRole('button', { name: 'Refresh' }).click()
  const grid = page.getByRole('list', { name: 'Variants' })
  await expect(grid.getByText('Signed off by 1')).toBeVisible()
  await expect(grid.getByRole('button', { name: 'Sign-offs (2)' })).toBeVisible()
  await shot(page, '96-tile-marks')

  const toggle = grid.getByRole('button', { name: 'Sign-offs (2)' })
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-expanded', 'true')
  await expect(grid.getByText(/^reviewer@example\.com · /)).toBeVisible()
  await expect(
    grid.getByText(/^second\.reviewer@example\.com · .* · for an earlier version$/),
  ).toBeVisible()
  await shot(page, '97-tile-signoff-list')
})
