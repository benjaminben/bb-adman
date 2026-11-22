// DLG-6b (spec/phases/design-wave-screens-b.md, "DLG-6b — Publish and the approval dialog"):
// 486, the publish dialog the first time (fake storage chosen, "First publish"); 487, the same
// dialog replacing a made-up earlier publish from another project; 488, the approval dialog
// with the turn-off confirm over it. Publishing uses only the fake storage (a sandbox folder)
// and nothing is published; the approval link is made on the approvals stand-in on 127.0.0.1
// with a made-up key and password. Before 488 is taken, the link field is given a made-up
// example.com address, so no stand-in address or slug is in the picture. Made-up names only.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page } from '@playwright/test'
import * as steps from '../approvals-local/app-steps'
import * as p from '../e2e/publish-steps'
import * as screens from '../e2e/screens'
import { startApprovalsStandIn, type ApprovalsStandIn } from '../helpers/approvals-stand-in'
import { closeApp, openApp, shot, type Session } from './shot'

// Made up for these pictures; the stand-in is told to accept the key.
const KEY = 'made-up-approvals-shot-key-6B'
const SHOWN_ADDRESS = 'https://approvals.example.com/l/made-up-link'
const OTHER_PROJECT = '01JD0000000000000000000077'

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

// A made-up earlier publish from another project, as a manifest and three files.
function plantPublished(userData: string, campaignId: string) {
  const folder = path.join(userData, 'fake-storage', campaignId)
  fs.mkdirSync(path.join(folder, 'ads'), { recursive: true })
  const files = ['ads/harbor-day-1080x1080-en.png', 'report-1.html', 'report-1.json']
  for (const f of files) fs.writeFileSync(path.join(folder, f), 'made-up')
  const manifest = {
    format: 1,
    appVersion: '0.1.0',
    projectId: OTHER_PROJECT,
    campaignId,
    publishNumber: 2,
    publishedAt: '2026-11-12T16:40:00.000Z',
    files: files.map((f) => ({ path: f, bytes: 7, sha256: 'b'.repeat(64) })),
  }
  fs.writeFileSync(path.join(folder, 'manifest.json'), JSON.stringify(manifest))
}

test('486 publish, the first time', async () => {
  session = await openApp()
  const { page, box } = session
  await still(page)
  await p.setUpCampaign(page, box.projects)
  await p.openCampaign(page)
  const dialog = await p.openOnFake(page)
  await expect(dialog.getByText('First publish')).toBeVisible()
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[role="dialog"] img')].every(
      (img) => (img as HTMLImageElement).complete,
    ),
  )
  await shot(page, '486-publish-first')
})

test('487 publish, replacing an earlier publish from another project', async () => {
  session = await openApp()
  const { page, box } = session
  await still(page)
  const { campaignId } = await p.setUpCampaign(page, box.projects)
  plantPublished(box.userData, campaignId)
  await p.openCampaign(page)
  const dialog = await p.openOnFake(page)
  await expect(dialog.getByText('From another project', { exact: true })).toBeVisible()
  await expect(dialog.getByRole('switch', { name: 'Replace the published files' })).toBeVisible()
  await shot(page, '487-publish-replace')
})

test('488 the approval dialog with the turn-off confirm', async () => {
  test.setTimeout(180_000)
  stand = await startApprovalsStandIn({ key: KEY })
  session = await openApp({ ADMAN_DEV_TOOLS: '1', ADMAN_APPROVALS_TEST_PICTURES: stand.origin })
  const { app, page } = session
  await still(page)
  await steps.setUpSettings(page, stand.origin, KEY)
  await screens.createProject(page, 'Approvals Shots')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await steps.makeLink(page)

  await steps
    .bar(page)
    .getByRole('button', { name: /^Approval link…/ })
    .click()
  const dialog = steps.dialog(page)
  const field = dialog.getByRole('textbox', { name: 'Link' })
  await field.evaluate((el, shown) => ((el as HTMLInputElement).value = shown), SHOWN_ADDRESS)
  await dialog.getByRole('button', { name: 'Turn off link…' }).click()
  const ask = page.getByRole('dialog', { name: 'Turn off link?' })
  await expect(ask.getByRole('button', { name: 'Keep link' })).toBeFocused()
  await shot(page, '488-approval-turn-off')
})
