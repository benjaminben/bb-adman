// P8-12: the reports list and one report's view. One campaign at two sizes in two languages,
// fanned out to four ads, exported twice through the export dialog with the fake providers to a
// folder in the sandbox. 255 the list with both exports, 256 the newest report's view. Nothing
// is paid and nothing leaves the machine. Made-up names only.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command, query } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

const CAMPAIGN = 'Harbour Lights Tea'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function setUp(page: Page) {
  await screens.createProject(page, 'Harbour Lights')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  await command(page, 'settings.update', { reports: { exporterName: 'Alex Moreno' } })
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'DE',
      audience: 'Commuters who like a warm cup',
      message: 'Slow down with a cup at dusk',
      callToAction: 'Try a cup today',
      subjects: [{ name: 'Tea tin' }],
    },
    subjectMap: [{ subjectId: 'tea-tin', create: true }],
    languages: ['en', 'de'],
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
    languages: ['en', 'de'],
    formats: ['image'],
    fits: { '1080x1920': 'scale' },
  })
}

// One export of every ad through the dialog, to the given folder, until the end counts show.
async function exportAll(session: Session, folder: string) {
  const { app, page } = session
  await page.getByRole('button', { name: 'Export…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Export campaign' })
  await expect(dialog.getByRole('checkbox')).toHaveCount(4)
  await screens.answerOpenDialog(app, [folder])
  await dialog.getByRole('button', { name: 'Choose folder…' }).click()
  await dialog.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(dialog.getByText(/^Exported \d+ ads\./)).toBeVisible({ timeout: 120_000 })
  await dialog.getByRole('button', { name: 'Close' }).click()
  await expect(dialog).toBeHidden()
}

test('Reports: the list after two exports, then the newest report', async () => {
  test.setTimeout(300_000)
  session = await openApp()
  const { page } = session
  const folder = path.join(session.box.root, 'Harbour Lights handover')
  fs.mkdirSync(folder)
  await setUp(page)
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()

  await exportAll(session, folder)
  await exportAll(session, folder)

  await page.getByRole('button', { name: 'Reports' }).click()
  const list = page.getByRole('dialog', { name: 'Reports' })
  await expect(list.getByRole('listitem')).toHaveCount(2)
  await expect(list.getByRole('listitem').first()).toContainText('Export 2 ·')
  await shot(page, '255-report-list')

  await list.getByRole('button', { name: 'Open' }).first().click()
  const view = page.getByRole('dialog', { name: 'Export report' })
  await expect(view.getByRole('region', { name: 'Summary' })).toBeVisible()
  await expect(view).toContainText('since export 1')
  await shot(page, '256-report-view')
})
