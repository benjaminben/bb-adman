// R2C-2 (spec/phases/round-2-campaign.md, design addition 2): the variant grid by size and
// language. 344: three sizes and three languages, the master top left, one cell left empty.
// 345: a narrow window, the direction's box scrolled to its last column. 346: a video copy of
// the master in the master's cell, under it (written into the closed project file, as
// format-switch.spec.ts does). Made-up names only; only the fake provider runs.
import { test, expect, type Page } from '@playwright/test'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import path from 'node:path'
import { ulid } from 'ulid'
import { command, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const PROJECT = 'Tidewater Coffee'
const CAMPAIGN = 'Harbour Blend'
const SIZES = [
  { label: '1080x1080', width: 1080, height: 1080 },
  { label: '1080x1920', width: 1080, height: 1920 },
  { label: '1920x1080', width: 1920, height: 1080 },
]
const LANGUAGES = ['en', 'de', 'fr']
const EMPTY = '1920x1080:de'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

type Place = { projectId: string; campaignId: string; filePath: string }

async function makeCampaign(page: Page): Promise<Place> {
  await screens.createProject(page, PROJECT)
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string; filePath: string }[]
  }
  const { projectId, filePath } = state.openProjects[0]!
  const { campaignId } = (await command(page, 'campaign.create', {
    projectId,
    brief: {
      campaignName: CAMPAIGN,
      region: 'US',
      audience: 'Early risers who walk to work',
      message: 'A bold roast from the harbour',
      callToAction: 'Find your cup',
      subjects: [{ name: 'Coffee bag' }],
    },
    subjectMap: [{ subjectId: 'coffee-bag', create: true }],
    languages: LANGUAGES,
    sizes: SIZES,
    templateId: 'starter',
  })) as { campaignId: string }
  const got = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    directions: { id: string }[]
  }
  const directionId = got.directions[0]!.id
  for (const size of SIZES) {
    for (const language of LANGUAGES) {
      if (size.label === '1080x1080' && language === 'en') continue
      if (`${size.label}:${language}` === EMPTY) continue
      const post = { projectId, directionId, sizeLabel: size.label, language }
      await command(page, 'variant.add', { ...post, format: 'image' })
    }
  }
  return { projectId, campaignId, filePath }
}

async function openCampaign(page: Page): Promise<void> {
  await page.getByRole('button', { name: `Open ${CAMPAIGN}` }).click()
  await expect(page.getByRole('heading', { name: CAMPAIGN, level: 2 })).toBeVisible()
  const list = page.getByRole('list', { name: /^Variants in / })
  await expect(list.getByRole('listitem')).toHaveCount(8)
  await page.waitForTimeout(500)
}

function copyRow(db: Database.Database, table: string, id: string, set: Record<string, string>) {
  const names = (db.prepare(`PRAGMA table_info("${table}")`).all() as { name: string }[]).map(
    (c) => c.name,
  )
  const pick = names.map((n) => (n in set ? '?' : `"${n}"`)).join(', ')
  db.prepare(
    `INSERT INTO "${table}" (${names.map((n) => `"${n}"`).join(', ')})
     SELECT ${pick} FROM "${table}" WHERE id = ?`,
  ).run(...names.filter((n) => n in set).map((n) => set[n]), id)
}

// A video copy of the master at its size and language, written into the closed project file.
function addVideoCopy(filePath: string): void {
  const db = new Database(filePath)
  try {
    const master = db.prepare('SELECT master_variant_id AS id FROM direction').get() as {
      id: string
    }
    const copyId = ulid()
    copyRow(db, 'variant', master.id, { id: copyId, title: 'Harbour Blend clip', format: 'video' })
    const layers = db.prepare('SELECT id FROM layer WHERE variant_id = ?').all(master.id)
    for (const { id } of layers as { id: string }[]) {
      copyRow(db, 'layer', id, { id: ulid(), variant_id: copyId })
    }
  } finally {
    db.close()
  }
}

test('the variant grid by size and language', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { page } = session
  const place = await makeCampaign(page)
  await openCampaign(page)
  await shot(page, '344-grid-three-sizes-three-languages')

  await page.getByRole('button', { name: 'Back to project' }).click()
  const close = page.getByRole('button', { name: `Close ${PROJECT}` })
  await close.click()
  await expect(close).toHaveCount(0)
  addVideoCopy(place.filePath)
  await page.getByRole('button', { name: new RegExp(`^Open ${PROJECT}`) }).click()
  await expect(page.getByRole('heading', { name: PROJECT, level: 1 })).toBeVisible()
  await openCampaign(page)
  await expect(page.getByText('Harbour Blend clip')).toBeVisible()
  await shot(page, '346-grid-image-and-video-in-one-cell')

  // The app's narrowest window (900 wide) with four more languages on the square row.
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const projectId = state.openProjects[0]!.projectId
  const campaign = (await query(page, 'project.get', { projectId })) as {
    campaigns: { id: string }[]
  }
  const campaignId = campaign.campaigns[0]!.id
  await addLanguages(page, projectId, campaignId)
  const list = page.getByRole('list', { name: /^Variants in / })
  await expect(list.getByRole('listitem')).toHaveCount(12)
  await page.setViewportSize({ width: 900, height: 800 })
  const box = list.locator('xpath=../..')
  const widths = await box.evaluate((el) => [el.scrollWidth, el.clientWidth])
  expect(widths[0]).toBeGreaterThan(widths[1]!)
  await box.evaluate((el) => {
    el.scrollIntoView({ block: 'start' })
    el.scrollTo({ left: el.scrollWidth })
  })
  const page_ = await page.evaluate(() => [
    document.documentElement.scrollWidth,
    document.documentElement.clientWidth,
  ])
  expect(page_[0]).toBe(page_[1])
  await page.waitForTimeout(300)
  fs.mkdirSync(path.resolve('shots'), { recursive: true })
  await page.screenshot({ path: path.resolve('shots', '345-grid-scrolled-sideways.png') })
})

async function addLanguages(page: Page, projectId: string, campaignId: string): Promise<void> {
  const more = ['es', 'it', 'nl', 'pt']
  await command(page, 'campaign.update', {
    projectId,
    campaignId,
    languages: [...LANGUAGES, ...more],
  })
  const got = (await query(page, 'campaign.get', { projectId, campaignId })) as {
    directions: { id: string }[]
  }
  const directionId = got.directions[0]!.id
  for (const language of more) {
    const post = { projectId, directionId, sizeLabel: SIZES[0]!.label, language }
    await command(page, 'variant.add', { ...post, format: 'image' })
  }
}
