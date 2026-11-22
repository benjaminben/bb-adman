// P9-15: the steps publish.spec.ts and the p9-15 shots share. A made-up campaign with one picture
// layer and a German post (so the translation sheet is made), published to the fake storage ({userData}/fake-storage) through the publish dialog
// only: no bucket, no Dropbox, no sign-in, no test hook. The set-up uses the window's own api,
// as the other end-to-end files do.
import fs from 'node:fs'
import path from 'node:path'
import { expect, type ElectronApplication, type Locator, type Page } from '@playwright/test'
import * as screens from './screens'
import { command, query } from './render-helpers'

export const CAMPAIGN = 'Harbor Day Cold Brew'
const PHOTO = path.resolve('tests/shots/fixtures/photos/glass-bottle.png')

export type Ids = { projectId: string; campaignId: string; variantId: string }
export type Size = { label: string; width: number; height: number }
const SQUARE: Size = { label: '1080x1080', width: 1080, height: 1080 }

// The app window, found by its page address (the quiet launch keeps every window hidden).
export async function appWindow(app: ElectronApplication): Promise<Page> {
  const pick = () => app.windows().find((p) => p.url().endsWith('/renderer/index.html'))
  await expect.poll(() => pick() !== undefined, { timeout: 30_000 }).toBe(true)
  return pick()!
}

// The picture is copied into the sandbox first, so the path shown is a made-up one there.
function sandboxPicture(projects: string): string {
  const folder = path.join(projects, 'Harbor Day pictures')
  fs.mkdirSync(folder, { recursive: true })
  const copy = path.join(folder, path.basename(PHOTO))
  fs.copyFileSync(PHOTO, copy)
  return copy
}

// One size, the square one unless another is given (the shots use a large one, so the
// publish runs long enough to be seen running).
export async function setUpCampaign(page: Page, projects: string, size = SQUARE): Promise<Ids> {
  await screens.createProject(page, 'Harbor Day')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const { assetIds } = (await command(page, 'asset.import', {
    projectId,
    paths: [sandboxPicture(projects)],
    library: 'asset',
    copy: false,
  })) as { assetIds: string[] }
  const { campaignId, variantId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Commuters',
      message: 'Cold brew for the early ferry',
      callToAction: 'Try it this week',
      subjects: [{ name: 'Bottle' }],
    },
    subjectMap: [{ subjectId: 'bottle', create: true }],
    languages: ['en', 'de'],
    sizes: [size],
    templateId: 'starter',
  })) as { campaignId: string; variantId: string }
  await command(page, 'layer.create', {
    projectId,
    variantId,
    type: 'image',
    values: {
      source: { assetId: assetIds[0] },
      geometry: { x: 390, y: 300, width: 300, height: 300, rotation: 0, crop: null },
      style: { opacity: 1 },
    },
  })
  await addGerman(page, { projectId, campaignId }, size.label)
  return { projectId, campaignId, variantId }
}

type Row = { layerId: string; sourceText: string | null; copyRev: number }

const GERMAN: Record<string, string> = {
  'Cold brew for the early ferry': 'Cold Brew für die frühe Fähre',
  'Try it this week': 'Diese Woche probieren',
}

// The German post, its texts typed and approved, so the ads have no warnings and the
// translation sheet has rows.
async function addGerman(
  page: Page,
  ids: { projectId: string; campaignId: string },
  sizeLabel: string,
): Promise<void> {
  const { projectId, campaignId } = ids
  const got = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    directions: Array<{ id: string }>
  }
  const directionId = got.directions[0]!.id
  const add = { projectId, directionId, sizeLabel, language: 'de', format: 'image' }
  await command(page, 'variant.add', add)
  const rows = async () =>
    ((await query(page, 'translation.forCampaign', { projectId, campaignId })) as { rows: Row[] })
      .rows
  for (const row of await rows()) {
    const text = GERMAN[row.sourceText ?? ''] ?? 'Hafentag'
    await command(page, 'translation.set', {
      projectId,
      layerId: row.layerId,
      text,
      applyToSameLanguage: false,
    })
  }
  const layers = (await rows()).map((r) => ({ layerId: r.layerId, copyRev: r.copyRev }))
  await command(page, 'translation.approve', { projectId, layers })
}

export async function openCampaign(page: Page): Promise<void> {
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()
}

// "Publish…", then "Fake provider", and the folder read.
export async function openOnFake(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Publish…' }).click()
  const dialog = page.getByRole('dialog', { name: `Publish ${CAMPAIGN}` })
  await dialog.getByRole('radio', { name: 'Fake provider' }).check()
  await expect(dialog.getByText('Looking at the published folder…')).toHaveCount(0)
  await expect(dialog.getByRole('heading', { name: 'Files that will be uploaded' })).toBeVisible()
  return dialog
}

// Publish, the started view, Close.
export async function pressPublish(dialog: Locator): Promise<void> {
  await dialog.getByRole('button', { name: 'Publish', exact: true }).click()
  await expect(dialog.getByRole('status')).toContainText('Publishing has started.')
}

export const activityButton = (page: Page) => page.getByRole('button', { name: /^Activity/ })

export const publishRows = (page: Page): Locator =>
  page
    .getByRole('region', { name: 'Activity' })
    .getByRole('listitem')
    .filter({ hasText: /^Publish/ })

export const fakeFolder = (userData: string, campaignId: string) =>
  path.join(userData, 'fake-storage', campaignId)

// Every file under a folder, as forward-slash paths relative to it, sorted.
export function filesUnder(folder: string): string[] {
  if (!fs.existsSync(folder)) return []
  const entries = fs.readdirSync(folder, { recursive: true, withFileTypes: true })
  return entries
    .filter((e) => e.isFile())
    .map((e) => path.relative(folder, path.join(e.parentPath, e.name)).split(path.sep).join('/'))
    .sort()
}
