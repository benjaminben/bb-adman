// R2C-6 (spec/phases/round-2-campaign.md, design addition 5): subjects in the Assets panel.
// 356: the Subjects group, one subject with a photo and one with none. 358: the new subject
// dialog's problem lines. 357: the dialog filled in, with two picked photos. 359: the subject
// made. 363: "Add photos…" on a card with a photo that is another subject's, and its note.
// The native picker is answered through the e2e helper. Made-up names only; nothing is paid.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { command, query } from '../e2e/render-helpers'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

const PROJECT = 'Tidewater Coffee'
const PHOTOS = path.resolve('tests/fixtures/briefs/photos')

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

const panel = (page: Page) => page.getByRole('region', { name: 'Assets' })

// A drawn stand-in for a portrait (a head and shoulders in flat shapes), as a PNG file.
async function drawPortrait(page: Page, to: string): Promise<string> {
  const url = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 240
    canvas.height = 240
    const g = canvas.getContext('2d')!
    g.fillStyle = '#d9e4ec'
    g.fillRect(0, 0, 240, 240)
    g.fillStyle = '#3d5a73'
    g.beginPath()
    g.ellipse(120, 240, 90, 70, 0, Math.PI, 0)
    g.fill()
    g.fillStyle = '#c99a7a'
    g.beginPath()
    g.arc(120, 105, 48, 0, Math.PI * 2)
    g.fill()
    return canvas.toDataURL('image/png')
  })
  fs.writeFileSync(to, Buffer.from(url.split(',')[1]!, 'base64'))
  return to
}

// Two subjects, one with a photo; the photo file stays in the sandbox (linked), so picking it
// again later is a reused file.
async function fillProject(page: Page, folder: string, projectId: string): Promise<string[]> {
  const copy = (from: string, name: string) => {
    const to = path.join(folder, name)
    fs.copyFileSync(path.join(PHOTOS, from), to)
    return to
  }
  const portrait = await drawPortrait(page, path.join(folder, 'linnea-portrait.png'))
  const tins = [copy('citrus-can.png', 'tin-front.png'), copy('berry-bottle.png', 'tin-side.png')]
  await command(page, 'subject.create', {
    projectId,
    id: 'Linnea-Park',
    name: 'Linnea Park',
    description: 'Head roaster at the harbour shop.',
  })
  await command(page, 'subject.create', { projectId, id: 'Tidewater-Mug', name: 'Tidewater Mug' })
  await command(page, 'asset.import', {
    projectId,
    paths: [portrait],
    library: 'asset',
    copy: false,
    subjectId: 'Linnea-Park',
  })
  return [...tins, portrait]
}

test('subjects in the Assets panel: the group, the new subject dialog, the photo note', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, box, page } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await screens.createProject(page, PROJECT)
  const state = (await query(page, 'app.getState', {})) as {
    openProjects: { projectId: string }[]
  }
  const { projectId } = state.openProjects[0]!
  const [front, side, portrait] = await fillProject(page, box.root, projectId)

  await page.getByRole('button', { name: 'Open assets' }).click()
  await expect(panel(page).getByRole('heading', { name: 'Subjects · 2' })).toBeVisible()
  await expect(panel(page).getByRole('img', { name: 'linnea-portrait.png' })).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '356-assets-subjects')

  await panel(page).getByRole('button', { name: 'New subject…' }).click()
  const dialog = page.getByRole('dialog', { name: 'New subject' })
  await dialog.getByRole('button', { name: 'Create subject' }).click()
  await expect(dialog.getByRole('alert')).toContainText('Add at least one photo.')
  await shot(page, '358-new-subject-problems')

  await dialog.getByRole('textbox', { name: 'Name' }).fill('Harbour Blend')
  await dialog
    .getByRole('textbox', { name: 'Description (optional)' })
    .fill('A dark roast in a blue tin.')
  await screens.answerOpenDialog(app, [front!, side!])
  await dialog.getByRole('button', { name: 'Add photos…' }).click()
  await expect(dialog.getByRole('list', { name: 'Photos to add' })).toBeVisible()
  await shot(page, '357-new-subject-dialog')

  await dialog.getByRole('button', { name: 'Create subject' }).click()
  await expect(dialog.getByText('Harbour Blend was made with 2 photo(s).')).toBeVisible()
  await shot(page, '359-new-subject-made')
  await dialog.getByRole('button', { name: 'Done' }).click()

  const blend = panel(page).getByRole('article', { name: 'Harbour Blend' })
  await expect(blend.locator('img')).toHaveCount(2)
  await screens.answerOpenDialog(app, [portrait!])
  await blend.getByRole('button', { name: 'Add photos to Harbour Blend' }).click()
  await expect(blend.getByText(/is already a photo of Linnea Park/)).toBeVisible()
  await page.waitForTimeout(500)
  await shot(page, '363-subject-photo-note')
})
