// CAMP-6 (spec/phases/design-wave-screens-b.md, "CAMP-6 — Reports"): 468, the reports dialog
// with two exports, the newest with one failed file. A campaign of two ads is exported twice
// through the export dialog to a folder in the sandbox; before the second export one ad's file
// is replaced by a folder of the same name, so that file cannot be written. Fake providers
// only, nothing is paid and nothing leaves the machine. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as ex from '../e2e/export-steps'
import { filesUnder } from '../e2e/publish-steps'
import { command, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Juniper Ridge Cider'

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

async function setUp(page: Page) {
  await screens.createProject(page, 'Juniper Ridge')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Friends at an autumn picnic',
      message: 'Crisp cider from the ridge',
      callToAction: 'Pour a glass',
      subjects: [{ name: 'Bottle' }],
    },
    subjectMap: [{ subjectId: 'bottle', create: true }],
    languages: ['en'],
    sizes: [
      { label: '1080x1080', width: 1080, height: 1080 },
      { label: '1080x1920', width: 1080, height: 1920 },
    ],
    templateId: 'starter',
  })) as { campaignId: string }
  const read = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    directions: { id: string }[]
  }
  await command(page, 'variant.fanOut', {
    projectId,
    directionId: read.directions[0]!.id,
    sizes: ['1080x1080', '1080x1920'],
    languages: ['en'],
    formats: ['image'],
    fits: { '1080x1920': 'scale' },
  })
}

// One export of every ad through the dialog, past the warnings step when it shows.
async function exportAll(session: Session, folder: string, line: RegExp) {
  const dialog = await ex.openExport(session.app, session.page, folder)
  await dialog.getByRole('button', { name: 'Export', exact: true }).click()
  const anyway = dialog.getByRole('button', { name: 'Export anyway' })
  await expect(anyway.or(dialog.getByText(line))).toBeVisible({ timeout: 120_000 })
  if (await anyway.isVisible()) await anyway.click()
  await ex.finishExport(dialog, line)
}

test('468 the reports dialog with two exports, one with a failure', async () => {
  test.setTimeout(300_000)
  session = await openApp()
  const { page } = session
  await still(page)
  const folder = ex.outputFolder(session.box.root, 'Juniper Ridge handover')
  await setUp(page)
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()

  await exportAll(session, folder, /2 exported/)
  const picture = filesUnder(folder).find((f) => f.endsWith('.png') && !f.includes('report'))
  const taken = path.join(folder, picture!)
  fs.rmSync(taken)
  fs.mkdirSync(taken)
  fs.writeFileSync(path.join(taken, 'keep.txt'), 'in the way')
  await exportAll(session, folder, /1 exported/)

  await page.getByRole('button', { name: `More actions for ${CAMPAIGN}` }).click()
  await page.getByRole('menuitem', { name: 'Reports…' }).click()
  const list = page.getByRole('dialog', { name: 'Reports' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list.getByText('1 failed')).toBeVisible()
  await shot(page, '468-reports-two-exports')
})
