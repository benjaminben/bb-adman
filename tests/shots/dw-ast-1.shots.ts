// AST-1 (spec/phases/design-wave-screens-b.md, "AST-1"): the Assets panel in the design wave's
// look. 456: subjects and pictures (one made by the fake provider, one a reference, one linked
// and missing). 457: Subjects and Pictures folded, so Clips and Fonts show. Made-up names and
// drawn pictures only; only the fake provider runs.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { command, FONT_FILE, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const PHOTOS = path.resolve('tests/fixtures/briefs/photos')
const CLIP = path.resolve('tests/fixtures/video/tiny.mp4')
const SHELF = path.resolve('tests/fixtures/webp/see-through-red.webp')

type Listed = { id: string; origin: string }

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

const panel = (page: Page) => page.getByRole('region', { name: 'Assets' })

async function importFile(page: Page, projectId: string, file: string, over = {}) {
  const reply = (await command(page, 'asset.import', {
    projectId,
    paths: [file],
    library: 'asset',
    copy: true,
    ...over,
  })) as { assetIds: string[] }
  return reply.assetIds[0]!
}

async function named(page: Page, projectId: string, file: string, name: string, over = {}) {
  const assetId = await importFile(page, projectId, file, over)
  await command(page, 'asset.update', { projectId, assetId, displayName: name })
  return assetId
}

async function madePicture(page: Page, projectId: string) {
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: 'Harbour Blend',
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
  await command(page, 'asset.update', { projectId, assetId: made.id, displayName: 'Dawn bag.png' })
}

async function fillProject(page: Page, folder: string, projectId: string) {
  const copy = (from: string, name: string) => {
    const to = path.join(folder, name)
    fs.copyFileSync(from, to)
    return to
  }
  await madePicture(page, projectId)
  await command(page, 'subject.create', {
    projectId,
    id: 'Tidewater-Mug',
    name: 'Tidewater Mug',
    description: 'The enamel mug sold at the counter.',
  })
  const can = copy(path.join(PHOTOS, 'citrus-can.png'), 'a.png')
  await named(page, projectId, can, 'Bag, front.png', { subjectId: 'harbour-blend-bag' })
  const mood = copy(path.join(PHOTOS, 'berry-bottle.png'), 'b.png')
  await named(page, projectId, mood, 'Mood board.png', { library: 'reference' })
  const shelf = copy(SHELF, 'shelf.webp')
  await named(page, projectId, shelf, 'Shop shelf.webp', { copy: false })
  fs.rmSync(shelf)
  await named(page, projectId, copy(CLIP, 'c.mp4'), 'Pour over.mp4')
  await named(page, projectId, copy(FONT_FILE, 'd.woff2'), 'Harbour Sans.woff2')
}

test('the Assets panel: subjects and pictures, then clips and fonts', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { box, page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await screens.createProject(page, 'Tidewater Coffee')
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  await fillProject(page, box.root, state.openProjects[0]!.projectId)

  // D-109: the panel is drawn only with a campaign open; it opens from the campaign head.
  await page.getByRole('button', { name: 'Open Harbour Blend' }).click()
  await page.getByRole('button', { name: 'Assets', exact: true }).click()
  const pictures = panel(page).getByRole('region', { name: 'Pictures' })
  await expect(pictures.locator('img')).toHaveCount(3)
  await expect(pictures.getByText('File not found')).toBeVisible()
  await page.mouse.move(800, 900)
  await page.waitForTimeout(500)
  await shot(page, '456-assets-subjects-pictures')

  for (const name of ['Subjects', 'Pictures'])
    await panel(page).getByRole('button', { name, exact: true }).click()
  await expect(panel(page).getByText('Harbour Sans.woff2')).toBeVisible()
  await page.mouse.move(800, 900)
  await page.waitForTimeout(500)
  await shot(page, '457-assets-clips-fonts')
})
