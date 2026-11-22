// P8-19, Phase 8 exit criterion 3: a whole-campaign export of examples/brief.yaml through the
// screens. The brief is loaded, a made-up photo added to each subject, the campaign made; the
// master's background is made with the fake provider and fanned out to the brief's three sizes
// and two languages (one size's background extended with the fake provider's fill): six ads.
// Export… with a temporary folder from the system picker (answered in the main process), every
// ad: the brief's own rules warn (a required word, German not yet translated), so "Export
// anyway". The folder holds exactly the layout's files, the report row and both report files
// exist. One ad is edited and the campaign exported again: the second report marks that ad
// changed and the others not changed, and is export 2. No paid call, nothing leaves the machine.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { answerQuit } from './quit-answer'
import * as screens from './screens'
import { query } from './render-helpers'
import { appWindow, filesUnder } from './publish-steps'
import * as w from './workflow-5-1-steps'
import * as v from './variants-steps'
import * as ex from './export-steps'

const BRIEF = path.resolve('examples/brief.yaml')
const PHOTOS = ['citrus-can.png', 'berry-bottle.png'].map((f) =>
  path.resolve('tests/fixtures/briefs/photos', f),
)
const CAMPAIGN = 'Summer Splash'
const DIRECTION = 'Direction 1'
// The title the campaign gives its ads, from the two subjects; already safe as a folder name.
const TITLE = 'citrus-can+berry-bottle'
const REPORT = /^report-\d{8}-\d{6}(-\d+)?\.(html|json)$/

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

type Ad = { id: string; sizeLabel: string; language: string }

async function makeCampaign(): Promise<ex.Place & { ads: Ad[] }> {
  await screens.createProject(page, 'Summer Splash')
  await screens.answerOpenDialog(app, [BRIEF])
  await page.getByRole('button', { name: 'Load a brief' }).click()
  const form = page.getByRole('region', { name: 'New campaign' })
  await expect(form.getByLabel('Campaign name')).toHaveValue(CAMPAIGN)
  await screens.addPhoto(app, form, 1, PHOTOS[0]!)
  await screens.addPhoto(app, form, 2, PHOTOS[1]!)
  await form.getByRole('button', { name: 'Create campaign' }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()

  await w.openMaster(page)
  await w.selectLayer(page, 'Background')
  await w.makePictures(page, 1)
  await w.useOption(page, 1)
  await v.showOverview(page)
  await v.fanOut(page, DIRECTION, {
    sizes: ['9x16 (1080×1920)', '16x9 (1920×1080)'],
    languages: ['de'],
    fill: '9x16 (1080×1920)',
  })
  await expect(v.grid(page, DIRECTION).getByRole('listitem')).toHaveCount(6)

  const place = await w.placeOf(page, CAMPAIGN)
  const read = (await query(page, 'campaign.get', place)) as { variants: Ad[] }
  return { projectId: place.projectId, campaignId: place.campaignId, ads: read.variants }
}

// Export… to the folder, every ad ticked; the warnings step, "Export anyway", the end counts.
async function exportEverything(folder: string): Promise<void> {
  const dialog = await ex.openExport(app, page, folder)
  await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(6)
  await dialog.getByRole('button', { name: 'Export', exact: true }).click()
  await expect(dialog.getByText('These ads have warnings')).toBeVisible()
  await dialog.getByRole('button', { name: 'Export anyway' }).click()
  await ex.finishExport(dialog, 'Exported 6 ads. 0 failed.')
}

const adFiles = (campaignId: string, ads: Ad[]) =>
  ads.map((ad) => `${campaignId}/${TITLE}/${ad.sizeLabel}/${ad.language}-${ad.id}.png`).sort()

test('a whole-campaign export of the example brief, then a second export after one edit', async () => {
  test.setTimeout(300_000)
  const { ads, ...place } = await makeCampaign()
  expect(ads.map((ad) => `${ad.sizeLabel} ${ad.language}`).sort()).toEqual([
    '16x9 de',
    '16x9 en',
    '1x1 de',
    '1x1 en',
    '9x16 de',
    '9x16 en',
  ])
  const folder = ex.outputFolder(box.root, 'Summer Splash handover')

  await exportEverything(folder)

  // Exactly the layout's files: one PNG per ad, one report of each kind.
  const first = filesUnder(folder)
  const reports = first.filter((f) => !f.endsWith('.png'))
  expect(first.filter((f) => f.endsWith('.png'))).toEqual(adFiles(place.campaignId, ads))
  expect(reports).toHaveLength(2)
  for (const file of reports) {
    expect(path.dirname(file)).toBe(place.campaignId)
    expect(path.basename(file)).toMatch(REPORT)
  }
  const stem = (f: string) => f.replace(/\.(html|json)$/, '')
  expect(stem(reports[0]!)).toBe(stem(reports[1]!))

  // The report row, kept with the folder's real path; its body is the JSON file's.
  const rows = await ex.reportsOf(page, place)
  expect(rows).toHaveLength(1)
  expect(rows[0]).toMatchObject({ exportNumber: 1, outputDir: fs.realpathSync(folder) })
  const json = reports.find((f) => f.endsWith('.json'))!
  const written = JSON.parse(fs.readFileSync(path.join(folder, json), 'utf8')) as {
    exportNumber: number
    outputFolderName: string
  }
  expect(written).toMatchObject({ exportNumber: 1, outputFolderName: 'Summer Splash handover' })
  const html = fs.readFileSync(
    path.join(
      folder,
      reports.find((f) => f.endsWith('.html'))!,
    ),
    'utf8',
  )
  expect(html).toContain(CAMPAIGN)
  expect(html).not.toContain(box.root)

  // One ad edited in the editor: the wide English one's headline.
  const edited = ads.find((ad) => ad.sizeLabel === '16x9' && ad.language === 'en')!
  await v.editLayer(page, v.tile(page, DIRECTION, '1920×1080 · en'), 'Headline')
  await v.setCopy(page, 'Summer Splash: cool down with every sip')
  await expect
    .poll(async () => {
      const got = (await query(page, 'variant.get', { ...place, variantId: edited.id })) as {
        layers: { slot: string | null; copy: string | null }[]
      }
      return got.layers.find((l) => l.slot === 'headline')?.copy
    })
    .toBe('Summer Splash: cool down with every sip')
  await v.showOverview(page)

  await exportEverything(folder)

  const again = await ex.reportsOf(page, place)
  expect(again.map((r) => r.exportNumber)).toEqual([2, 1])
  const second = await ex.reportOf(page, place.projectId, again[0]!.reportId)
  expect(second.exportNumber).toBe(2)
  const changed = Object.fromEntries(
    second.variants.map((ad) => [ad.variantId, ad.changedSincePrevious]),
  )
  const wanted = ads.map((ad) => [ad.id, ad.id === edited.id ? 'changed' : 'unchanged'])
  expect(changed).toEqual(Object.fromEntries(wanted))
  // The same ad files, replaced in place, and a second pair of report files beside the first.
  const after = filesUnder(folder)
  expect(after.filter((f) => f.endsWith('.png'))).toEqual(adFiles(place.campaignId, ads))
  expect(after.filter((f) => !f.endsWith('.png'))).toHaveLength(4)
})
