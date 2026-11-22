// P8-19 [FR-115, FR-236]: the export's warnings gate through the screens. A one-ad campaign whose
// rules prohibit "cheap"; the word is typed into the headline in the editor. Export… shows the
// warnings step naming the ad and the word; a reason is typed and "Export anyway" pressed. The
// report keeps the reason: in the Reports view, in report.get and in both report files. Fake
// providers only, no paid call. Made-up names only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { showCampaignView } from './campaign-view-steps'
import { makeSandbox, launch, type Sandbox } from './launch'
import { answerQuit } from './quit-answer'
import * as screens from './screens'
import { command, query } from './render-helpers'
import { appWindow, filesUnder } from './publish-steps'
import * as v from './variants-steps'
import * as ex from './export-steps'

const CAMPAIGN = 'Pebble Cove Lemonade'
const DIRECTION = 'Direction 1'
const HEADLINE = 'Never cheap, always cold'
const REASON = 'The client approved this wording on the call.'

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await appWindow(app)
})
test.afterEach(async () => {
  try {
    await answerQuit(app)
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

// A project and a one-ad campaign in English only, opened on its page.
async function campaign(): Promise<ex.Place> {
  await screens.createProject(page, 'Pebble Cove')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Families at the beach',
      message: 'Cold lemonade by the sea',
      callToAction: 'Grab a glass',
      subjects: [{ name: 'Jar' }],
    },
    subjectMap: [{ subjectId: 'jar', create: true }],
    languages: ['en'],
    sizes: [{ label: '1080x1080', width: 1080, height: 1080 }],
    templateId: 'starter',
  })) as { campaignId: string }
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()
  return { projectId, campaignId }
}

test('a prohibited word: the warnings step, a reason, Export anyway, and the reason in the report', async () => {
  test.setTimeout(180_000)
  const place = await campaign()

  // The rule, typed in the campaign's rules panel; the word, typed into the headline.
  await showCampaignView(page, 'Checks')
  const rules = page.getByRole('region', { name: 'Brand and legal rules' })
  const words = rules.getByLabel('Prohibited words (en)')
  await words.fill('cheap')
  await words.blur()
  await expect(words).toHaveValue('cheap')
  await showCampaignView(page, 'Variants')
  await v.editLayer(page, v.tile(page, DIRECTION, '1080×1080 · en'), 'Headline')
  await v.setCopy(page, HEADLINE)
  await v.showOverview(page)

  const folder = ex.outputFolder(box.root, 'Pebble Cove export')
  const dialog = await ex.openExport(app, page, folder)
  await dialog.getByRole('button', { name: 'Export', exact: true }).click()

  // The warnings step: the ad and the word, nothing written yet.
  const list = dialog.getByRole('list', { name: 'These ads have warnings' })
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list).toContainText('1080x1080 · en')
  await expect(list).toContainText('cheap')
  expect(filesUnder(folder)).toEqual([])
  await dialog.getByLabel('Reason for exporting anyway (optional)').fill(`  ${REASON}  `)
  await dialog.getByRole('button', { name: 'Export anyway' }).click()
  await ex.finishExport(dialog, 'Exported 1 ad. 0 failed.')

  // The Reports view of that export shows the warning and the reason, trimmed.
  await page.getByRole('button', { name: 'Reports' }).click()
  const reports = page.getByRole('dialog', { name: 'Reports' })
  await expect(reports.getByRole('listitem')).toHaveCount(1)
  await reports.getByRole('button', { name: 'Open' }).click()
  const view = page.getByRole('dialog', { name: 'Export report' })
  await expect(view).toContainText('cheap')
  await expect(view).toContainText(REASON)

  // The stored report and both files hold the same reason, and the warning seen at the gate.
  const [row] = await ex.reportsOf(page, place)
  const report = await ex.reportOf(page, place.projectId, row!.reportId)
  expect(report.proceeded?.reason).toBe(REASON)
  expect(report.warningsExportedPast).toEqual([
    expect.objectContaining({ checkId: 'prohibited-words', seenBeforeExport: true }),
  ])
  const files = filesUnder(folder).filter((f) => /report-[^/]+\.(html|json)$/.test(f))
  expect(files).toHaveLength(2)
  for (const file of files) {
    expect(fs.readFileSync(path.join(folder, file), 'utf8')).toContain(REASON)
  }
})
