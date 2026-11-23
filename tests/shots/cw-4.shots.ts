// CW-4 (spec/phases/custom-workflows-slices.md, "CW-4"): 520 the Section with three rows (one
// added by an agent), 521 empty, 522 a refusal line, 523 Change for a video workflow, 524
// Remove, 525 "How to mark steps" open. The three rows are stored files written into the
// sandbox's userData before the app starts, as the store reads them at start. Made-up names;
// no server is contacted, nothing is sent from a dialog.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch } from '../e2e/launch'
import { answerOpenDialog } from '../e2e/screens'
import { openSettingsPage } from '../e2e/settings-pages'
import { closeApp, shot, type Session } from './shot'

const FIXTURES = path.resolve('tests/fixtures/comfy-custom')
const graph = (name: string) => JSON.parse(fs.readFileSync(path.join(FIXTURES, name), 'utf8'))

const STORED = [
  {
    id: 'custom-0a1b2c3d4e5f',
    name: 'Studio portrait',
    addedBy: 'user',
    addedAt: '2026-11-20T09:30:00.000Z',
    size: { multiple: 16, minPixels: 838_861, maxPixels: 1_048_576 },
    video: null,
    graph: graph('picture.json'),
  },
  {
    id: 'custom-1a2b3c4d5e6f',
    name: 'Tide clip',
    addedBy: 'agent',
    addedAt: '2026-11-21T14:05:00.000Z',
    size: { multiple: 32, minPixels: 327_680, maxPixels: 409_600 },
    video: { fps: 16, maxMs: 8_000, frameStep: 4, frameOffset: 1 },
    graph: graph('video-prompt.json'),
  },
  {
    id: 'custom-2a3b4c5d6e7f',
    name: 'Harbour poster from two pictures',
    addedBy: 'user',
    addedAt: '2026-11-22T08:00:00.000Z',
    size: null,
    video: null,
    graph: graph('two-refs.json'),
  },
]

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

async function open(withRows: boolean): Promise<Page> {
  const box = makeSandbox()
  if (withRows) {
    const dir = path.join(box.userData, 'comfy-workflows')
    fs.mkdirSync(dir)
    for (const w of STORED) {
      fs.writeFileSync(path.join(dir, `${w.id}.json`), JSON.stringify({ format: 1, ...w }))
    }
  }
  const app = await launch(box)
  const page = await app.firstWindow()
  await page.setViewportSize({ width: 1280, height: 800 })
  session = { box, app, page }
  await openSettingsPage(page, 'AI services')
  return page
}

const section = (page: Page) => page.getByRole('region', { name: 'ComfyUI workflows' })

async function showSection(page: Page) {
  await section(page).scrollIntoViewIfNeeded()
}

test('CW-4: the ComfyUI workflows Section with three rows, Change, Remove, the help', async () => {
  test.setTimeout(180_000)
  const page = await open(true)
  const list = section(page).getByRole('list', { name: 'Added workflows' })
  await expect(list.getByRole('listitem')).toHaveCount(3)
  await showSection(page)
  await shot(page, '520-settings-comfy-workflows')

  await list.getByRole('button', { name: 'Change' }).nth(1).click()
  await expect(page.getByRole('dialog', { name: 'Change workflow' })).toBeVisible()
  await shot(page, '523-change-workflow-video')
  await page.getByRole('button', { name: 'Cancel' }).click()

  await list.getByRole('button', { name: 'Remove Tide clip' }).click()
  await expect(page.getByRole('dialog', { name: 'Remove Tide clip?' })).toBeVisible()
  await shot(page, '524-remove-workflow')
  await page.getByRole('button', { name: 'Keep' }).click()

  await section(page).getByRole('button', { name: 'How to mark steps' }).click()
  await expect(page.getByRole('region', { name: 'How to mark steps' })).toContainText(
    'adman: output',
  )
  await showSection(page)
  // The fold's chevron turns in --motion-fast; the picture waits for it to stop.
  await page.waitForTimeout(400)
  await shot(page, '525-how-to-mark-steps')
})

test('CW-4: empty, then a refused file', async () => {
  test.setTimeout(180_000)
  const page = await open(false)
  await expect(section(page).getByText('No workflows added yet.')).toBeVisible()
  await showSection(page)
  await shot(page, '521-settings-comfy-workflows-empty')

  const picked = path.join(session!.box.root, 'Harbour canvas.json')
  fs.copyFileSync(path.join(FIXTURES, 'canvas.json'), picked)
  await answerOpenDialog(session!.app, [picked])
  await section(page).getByRole('button', { name: 'Add workflow…' }).click()
  await expect(section(page).getByText(/canvas file/)).toBeVisible()
  await showSection(page)
  await shot(page, '522-add-workflow-refused')
})
