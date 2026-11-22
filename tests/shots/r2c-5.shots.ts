// R2C-5 (spec/phases/round-2-campaign.md, design addition 5): the Assets panel. 352: the
// project page's "Assets" section. 354: the panel of a project with no file. 353: the panel
// with three pictures (one a reference, one made by the fake provider), a clip and a font.
// 355: the panel open over a variant's editor. Made-up names only; only the fake provider runs.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { command, FONT_FILE, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const PROJECT = 'Tidewater Coffee'
const CAMPAIGN = 'Harbour Blend'
const PHOTOS = path.resolve('tests/fixtures/briefs/photos')
const CLIP = path.resolve('tests/fixtures/video/tiny.mp4')

type Listed = { id: string; origin: string; kind: string }

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

const panel = (page: Page) => page.getByRole('region', { name: 'Assets' })

async function importFile(page: Page, projectId: string, file: string, library = 'asset') {
  const reply = (await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library,
    copy: true,
  })) as { assetIds: string[] }
  return reply.assetIds[0]!
}

async function rename(page: Page, projectId: string, assetId: string, displayName: string) {
  await command(page, 'asset.update', { projectId, assetId, displayName })
}

// A campaign, one fake picture for its master, and the files, each with a made-up name.
async function fillProject(page: Page, folder: string, projectId: string): Promise<void> {
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Early risers who walk to work',
      message: 'A bold roast from the harbour',
      subjects: [{ name: 'Harbour Blend bag' }],
    },
    subjectMap: [{ subjectId: 'harbour-blend-bag', create: true }],
    languages: ['en'],
    sizes: [{ label: '1080x1080', width: 1080, height: 1080 }],
    templateId: 'starter',
  })) as { campaignId: string }
  const got = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    variants: { id: string }[]
  }
  await command(page, 'generation.runImages', {
    projectId,
    variantId: got.variants[0]!.id,
    slot: 'background',
    prompt: 'A paper coffee bag on a harbour wall at dawn',
    referenceAssetIds: [],
    count: 1,
    provider: 'fake',
  })
  const listed = async () => (await query(page, 'asset.list', { projectId })) as unknown as Listed[]
  await expect.poll(async () => (await listed()).some((a) => a.origin === 'generated')).toBe(true)
  const made = (await listed()).find((a) => a.origin === 'generated')!
  await rename(page, projectId, made.id, 'Bag on the harbour wall.png')

  const copy = (from: string, name: string) => {
    const to = path.join(folder, name)
    fs.copyFileSync(from, to)
    return to
  }
  const bag = await importFile(page, projectId, copy(path.join(PHOTOS, 'citrus-can.png'), 'a.png'))
  await rename(page, projectId, bag, 'Harbour Blend bag.png')
  await command(page, 'asset.update', { projectId, assetId: bag, subjectId: 'harbour-blend-bag' })
  const mood = copy(path.join(PHOTOS, 'berry-bottle.png'), 'b.png')
  await rename(
    page,
    projectId,
    await importFile(page, projectId, mood, 'reference'),
    'Mood board.png',
  )
  await rename(
    page,
    projectId,
    await importFile(page, projectId, copy(CLIP, 'c.mp4')),
    'Pour over.mp4',
  )
  const font = await importFile(page, projectId, copy(FONT_FILE, 'd.woff2'))
  await rename(page, projectId, font, 'Harbour Sans.woff2')
}

test('the Assets panel: the section, empty, with files, over the editor', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { box, page } = session
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await screens.createProject(page, PROJECT)
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const { projectId } = state.openProjects[0]!
  await expect(page.getByRole('heading', { name: 'Assets', level: 2 })).toBeVisible()
  await shot(page, '352-project-assets-section')

  const open = page.getByRole('button', { name: 'Open assets' })
  await open.click()
  await expect(panel(page).getByText('No pictures yet.')).toBeVisible()
  await shot(page, '354-assets-panel-empty')
  await panel(page).getByRole('button', { name: 'Close assets' }).click()

  await fillProject(page, box.root, projectId)
  await open.click()
  await expect(panel(page).getByRole('heading', { name: 'Pictures · 3' })).toBeVisible()
  await expect(panel(page).getByRole('heading', { name: 'Fonts · 1' })).toBeVisible()
  await expect(panel(page).locator('img')).toHaveCount(3)
  await page.waitForTimeout(500)
  await shot(page, '353-assets-panel-files')
  await panel(page).getByRole('button', { name: 'Close assets' }).click()

  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  const tiles = page
    .getByRole('list', { name: /^Variants in / })
    .getByRole('button', { name: /^(?!Open |Quick look at |Delete )/ })
  await tiles.first().dblclick()
  await expect(page.getByRole('region', { name: /^Canvas, / })).toBeVisible()
  await page.getByRole('button', { name: 'Assets', exact: true }).click()
  await expect(panel(page).getByRole('heading', { name: 'Pictures · 3' })).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '355-assets-panel-over-editor')
})
