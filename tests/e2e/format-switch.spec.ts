// P7-17 (spec/phases/phase-07-slices-2.md): the editor's top bar changes an ad between image and
// video, sets a video's length, and shows the grid refusal of variant.setFormat with the stored
// format kept.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import { ulid } from 'ulid'
import { makeSandbox, launch, type Sandbox } from './launch'
import { firstIds } from './held-run'
import * as screens from './screens'
import { timeline } from './timeline-seed'

const GRID = 'This direction already has a video post at this size and language.'
const COPY_TITLE = 'Short clip copy'

let box: Sandbox
let app: ElectronApplication | undefined
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(async () => {
  await app?.close()
  app = undefined
  fs.rmSync(box.root, { recursive: true, force: true })
})

const format = (page: Page) => page.getByRole('radiogroup', { name: 'Format' })
const length = (page: Page) => page.getByRole('textbox', { name: 'Length (seconds)' })
const tiles = (page: Page) => page.getByRole('list', { name: 'Variants' }).getByRole('button')

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

// A video copy of the variant at its size and language, written into the closed project file.
function addVideoCopy(filePath: string, variantId: string): void {
  const db = new Database(filePath)
  try {
    const copyId = ulid()
    copyRow(db, 'variant', variantId, { id: copyId, title: COPY_TITLE, format: 'video' })
    const layers = db.prepare('SELECT id FROM layer WHERE variant_id = ?').all(variantId)
    for (const { id } of layers as { id: string }[]) {
      copyRow(db, 'layer', id, { id: ulid(), variant_id: copyId })
    }
  } finally {
    db.close()
  }
}

async function openEditor(page: Page): Promise<void> {
  await screens.openCampaign(page)
  await tiles(page).filter({ hasNotText: COPY_TITLE }).first().click()
  await expect(format(page)).toBeVisible()
}

test('switches an ad to video, sets its length, and switches it back', async () => {
  app = await launch(box)
  const page = await app.firstWindow()
  await screens.createProject(page, 'Format Check')
  await screens.loadBriefAndCreate(app, page)
  await openEditor(page)

  await expect(format(page).getByRole('radio', { name: 'Image' })).toBeChecked()
  await expect(length(page)).toHaveCount(0)
  await expect(timeline(page)).toHaveCount(0)

  await format(page).getByRole('radio', { name: 'Video' }).click()
  await expect(format(page).getByRole('radio', { name: 'Video' })).toBeChecked()
  await expect(timeline(page)).toBeVisible()

  await length(page).fill('12')
  await length(page).press('Enter')
  await expect(length(page)).toHaveValue('12.0')
  await expect(timeline(page).getByText('0:00.0 / 0:12.0')).toBeVisible()

  await length(page).fill('40')
  await length(page).press('Escape')
  await expect(length(page)).toHaveValue('12.0')

  await format(page).getByRole('radio', { name: 'Image' }).click()
  await expect(format(page).getByRole('radio', { name: 'Image' })).toBeChecked()
  await expect(timeline(page)).toHaveCount(0)
  await expect(length(page)).toHaveCount(0)
})

test('shows the grid refusal and keeps the stored format', async () => {
  app = await launch(box)
  const page = await app.firstWindow()
  const name = 'Grid Check'
  await screens.createProject(page, name)
  await screens.loadBriefAndCreate(app, page)
  const ids = await firstIds(page)
  const close = page.getByRole('button', { name: `Close ${name}` })
  await close.click()
  await expect(close).toHaveCount(0)
  addVideoCopy(ids.filePath, ids.variantId)
  await page.getByRole('button', { name: new RegExp(`^Open ${name}`) }).click()
  await expect(page.getByRole('heading', { name, level: 1 })).toBeVisible()
  await openEditor(page)

  await format(page).getByRole('radio', { name: 'Video' }).click()
  await expect(page.getByRole('alert').filter({ hasText: GRID })).toBeVisible()
  await expect(format(page).getByRole('radio', { name: 'Image' })).toBeChecked()
  await expect(timeline(page)).toHaveCount(0)
})
