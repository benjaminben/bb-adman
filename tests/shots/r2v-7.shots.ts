// R2V-7: the approval dialog's still-only lines, then an update's progress line with "Stop",
// and "Stopping…". Against the approvals stand-in on 127.0.0.1 and the test picture store (dev
// tools on). Two variants are made video posts in the closed project file, with the reasons
// their clips were not sent; the progress event is sent to the window by the main process while
// the stand-in holds the gallery request. Reduce motion and a fixed Math.random hold the
// picture still. Made-up names only; nothing leaves this machine.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import Database from 'better-sqlite3'
import * as screens from '../e2e/screens'
import { firstIds } from '../e2e/held-run'
import * as steps from '../approvals-local/app-steps'
import { startApprovalsStandIn, type ApprovalsStandIn } from '../helpers/approvals-stand-in'
import { closeApp, openApp, shot, type Session } from './shot'

const KEY = 'made-up-approvals-shot-key-R2V7'
const NAME = 'Harbour Lights Range'

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

// Two variants of other sizes become video posts the gallery shows as stills only.
function plantStillOnly(filePath: string, campaignId: string): void {
  const db = new Database(filePath)
  try {
    const rows = db
      .prepare(
        `SELECT v.id, v.size_label AS size FROM variant v JOIN direction d ON v.direction_id = d.id
         WHERE d.campaign_id = ? ORDER BY v.created_at, v.id`,
      )
      .all(campaignId) as { id: string; size: string }[]
    const picked = rows.filter((r, i) => rows.findIndex((x) => x.size === r.size) === i)
    const reasons = [
      ['too_long', 240_000],
      ['too_large', 30_000],
    ] as const
    reasons.forEach(([reason, ms], i) => {
      const id = picked[i]?.id
      if (id === undefined) throw new Error('not enough variants of different sizes')
      db.prepare("UPDATE variant SET format = 'video', duration_ms = ? WHERE id = ?").run(ms, id)
      db.prepare('UPDATE approval_variant SET clip_missing = ? WHERE variant_id = ?').run(
        reason,
        id,
      )
    })
  } finally {
    db.close()
  }
}

async function closeProject(page: Page): Promise<void> {
  const close = page.getByRole('button', { name: `Close ${NAME}` })
  await close.click()
  await expect(close).toHaveCount(0)
}

async function sendProgress(app: ElectronApplication, payload: object): Promise<void> {
  await app.evaluate(({ BrowserWindow }, p) => {
    BrowserWindow.getAllWindows()[0]?.webContents.send('adman:event', {
      name: 'approvals.progress',
      payload: p,
    })
  }, payload)
}

test('Approval link: still-only lines, then an update with Stop', async () => {
  test.setTimeout(180_000)
  stand = await startApprovalsStandIn({ key: KEY })
  session = await openApp({ ADMAN_DEV_TOOLS: '1', ADMAN_APPROVALS_TEST_PICTURES: stand.origin })
  const { app, page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await steps.setUpSettings(page, stand.origin, KEY)
  await screens.createProject(page, NAME)
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)
  await steps.makeLink(page)

  const ids = await firstIds(page)
  await closeProject(page)
  plantStillOnly(ids.filePath, ids.campaignId)
  await page.getByRole('button', { name: new RegExp(`^Open ${NAME}`) }).click()
  await expect(page.getByRole('heading', { name: NAME, level: 1 })).toBeVisible()
  await screens.openCampaign(page)

  await steps.bar(page).getByRole('button', { name: 'Approval link…' }).click()
  const box = steps.dialog(page)
  await expect(box.getByText(/sent as a still picture/)).toHaveCount(2)
  await shot(page, '92-r2v-still-only')

  stand.once('replaceGallery', { wait: true })
  await box.getByRole('button', { name: 'Update gallery' }).click()
  await expect(box.getByText('Updating the gallery…')).toBeVisible()
  const { projectId, campaignId } = ids
  await sendProgress(app, { projectId, campaignId, step: 'making', done: 0, total: 2 })
  await expect(box.getByText('Making video 1 of 2…')).toBeVisible()
  await shot(page, '92-r2v-making-video')

  await box.getByRole('button', { name: 'Stop' }).click()
  await expect(box.getByText('Stopping…')).toBeVisible()
  await expect(box.getByRole('button', { name: 'Stop' })).toBeDisabled()
  await shot(page, '92-r2v-stopping')
})
