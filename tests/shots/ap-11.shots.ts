// AP-11: the approval link dialog and the campaign page's approval bar, against the approvals
// stand-in on 127.0.0.1 and the test picture store (dev tools on). The service, a made-up
// bucket and made-up keys are saved through Settings; the e2e brief makes the campaign. The
// sign-off is planted in the stand-in, at example.com. Nothing leaves this machine.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { startApprovalsStandIn, type ApprovalsStandIn } from '../helpers/approvals-stand-in'
import { closeApp, openApp, shot, type Session } from './shot'

// Made up for these pictures; the stand-in is told to accept the key.
const KEY = 'made-up-approvals-shot-key-W2LC'

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

// A sign-off on the first variant in the gallery, as a reviewer would leave it.
function plantSignoff(on: ApprovalsStandIn) {
  const [pair, link] = [...on.links.entries()][0] ?? []
  const first = link?.gallery[0]
  if (pair === undefined || first === undefined) throw new Error('no gallery on the stand-in')
  const [projectId = '', campaignId = ''] = pair.split('/')
  on.plantSignoff(projectId, campaignId, {
    id: 'Sg4kPq7mZt2vWx9bLn3cRd8h',
    variantKey: first.variantKey,
    version: first.version,
    email: 'reviewer@example.com',
    signedAt: new Date().toISOString(),
  })
}

test('Approval link: new, live, turn off, and the bar', async () => {
  test.setTimeout(180_000)
  stand = await startApprovalsStandIn({ key: KEY })
  session = await openApp({ ADMAN_DEV_TOOLS: '1', ADMAN_APPROVALS_TEST_PICTURES: stand.origin })
  const { app, page } = session
  await setUpSettings(page, stand.origin)
  await screens.createProject(page, 'Approvals Shots')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)

  await page.getByRole('button', { name: 'Approval link…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Approval link' })
  await expect(dialog.getByRole('radio', { name: 'Make a password for me' })).toBeChecked()
  await shot(page, '92-approval-dialog-new')

  await dialog.getByRole('button', { name: 'Make link' }).click()
  await expect(dialog.getByText(/^Updated /)).toBeVisible({ timeout: 60_000 })
  plantSignoff(stand)
  await dialog.getByRole('button', { name: 'Close' }).click()

  const bar = page.getByRole('group', { name: 'Approval link' })
  await bar.getByRole('button', { name: 'Refresh' }).click()
  await expect(bar.getByText(/^Signed off: 1 of \d+ variants?$/)).toBeVisible()
  await expect(bar.getByText(/^Checked /)).toBeVisible()
  await shot(page, '95-campaign-approval-bar')

  await bar.getByRole('button', { name: 'Approval link…' }).click()
  await expect(dialog.getByText(/^reviewer@example\.com · /)).toBeVisible()
  await shot(page, '93-approval-dialog-live')

  await dialog.getByRole('button', { name: 'Turn off link…' }).click()
  await expect(dialog.getByRole('button', { name: 'Keep link' })).toBeFocused()
  await shot(page, '94-approval-dialog-turn-off')
})
