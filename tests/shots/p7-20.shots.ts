// P7-20: the clip track of a video variant. 229: the empty track. 230: two clips with a gap.
// 231: a trim in hand. 232: the add list. 233: a refusal under the row (the chosen file was
// deleted from disk after the list showed it). Made-up names and the made-up test clip only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { answerOpenDialog } from '../e2e/screens'
import { openVideoEditor, timeline } from '../e2e/timeline-seed'
import { closeApp, openApp, shot, type Session } from './shot'

const TINY = path.resolve('tests/fixtures/video/tiny.mp4')
const TINY_SOUND = path.resolve('tests/fixtures/video/tiny-sound.mp4')
const STILL = path.resolve('tests/fixtures/briefs/photos/berry-bottle.png')

let session: Session | undefined

test.afterEach(async () => {
  try {
    await closeApp(session)
  } finally {
    session = undefined
  }
})

const clips = (page: Page) => timeline(page).getByRole('list', { name: 'Clips' })
const addList = (page: Page) => timeline(page).getByRole('list', { name: 'Pictures and videos' })

async function importAndAdd(app: ElectronApplication, page: Page, file: string) {
  await answerOpenDialog(app, [file])
  await timeline(page).getByRole('button', { name: 'Add clip…' }).click()
  await timeline(page).getByRole('button', { name: 'Import…' }).click()
  await addList(page)
    .getByRole('button', { name: path.basename(file) })
    .click()
}

test('the clip track: empty, two clips with a gap, a trim, the add list, a refusal', async () => {
  session = await openApp()
  const { app, page, box } = session
  await openVideoEditor(app, page, 'Lemon Fizz')
  await shot(page, '229-clip-track-empty')

  await importAndAdd(app, page, TINY)
  await importAndAdd(app, page, STILL)
  const still = 'Clip 2: berry-bottle.png'
  await expect(clips(page).getByRole('button', { name: still })).toBeVisible()
  await clips(page).getByRole('button', { name: still }).focus()
  await page.keyboard.press('Shift+ArrowRight')
  const end = clips(page).getByRole('slider', { name: `End of ${still}` })
  await expect(end).toHaveAttribute('aria-valuenow', /^\d+$/)
  await end.focus()
  await page.keyboard.press('Shift+ArrowLeft')
  await page.keyboard.press('Shift+ArrowLeft')
  await expect(end).toHaveAttribute('aria-valuenow', '7000')
  await shot(page, '230-clip-track-gap')

  const handle = (await end.boundingBox())!
  const y = handle.y + handle.height / 2
  await page.mouse.move(handle.x + handle.width / 2, y)
  await page.mouse.down()
  await page.mouse.move(handle.x - handle.width * 6, y, { steps: 6 })
  await shot(page, '231-clip-track-trim')
  await page.mouse.up()

  const gone = path.join(box.root, 'harbour-dusk.mp4')
  fs.copyFileSync(TINY_SOUND, gone)
  await answerOpenDialog(app, [gone])
  await timeline(page).getByRole('button', { name: 'Add clip…' }).click()
  await timeline(page).getByRole('button', { name: 'Import…' }).click()
  await expect(addList(page).getByRole('button', { name: 'harbour-dusk.mp4' })).toBeVisible()
  await shot(page, '232-clip-track-add-list')

  fs.rmSync(gone)
  await addList(page).getByRole('button', { name: 'harbour-dusk.mp4' }).click()
  await expect(timeline(page).getByRole('alert')).toBeVisible()
  await shot(page, '233-clip-track-refusal')
})
