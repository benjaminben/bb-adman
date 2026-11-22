// R2E-8: the Generate panel makes videos (spec/phases/round-2-editor.md D4, D6). An image post
// with a drawn dune picture on its background becomes a video of 8 s, so the picture is the
// first clip. 330: the background layer's "Generate" with "Video" chosen. 331: the run dialog
// with fal.ai Seedance chosen, its line naming 4 seconds and its length line; it is cancelled,
// so nothing is sent. 332: a fake run from this layer's picture, working. 333: done, the clip in
// place of the still on the timeline, with its preview. Only the fake provider runs; the poll's
// two-second pause is held in the main process for 332 and let go for 333. Reduce motion and
// a fixed Math.random keep the window still.
import { test, expect, type ElectronApplication } from '@playwright/test'
import * as s from '../e2e/video-variant-steps'
import { timeline } from '../e2e/timeline-seed'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await releasePauses(session?.app)
  await closeApp(session)
  session = undefined
})

type Held = { __heldPauses?: (() => void)[]; __realSetTimeout?: typeof setTimeout }

// Holds every two-second timer of the main process (the video job's poll pause) until let go.
async function holdPauses(app: ElectronApplication): Promise<void> {
  await app.evaluate(() => {
    const g = globalThis as unknown as Held
    const real = globalThis.setTimeout
    g.__realSetTimeout = real
    g.__heldPauses = []
    globalThis.setTimeout = ((fn: (...a: unknown[]) => void, ms?: number, ...args: unknown[]) => {
      if (ms !== 2_000) return real(fn, ms, ...args)
      g.__heldPauses?.push(() => fn(...args))
      return real(() => {}, 2 ** 31 - 1)
    }) as typeof setTimeout
  })
}

async function releasePauses(app: ElectronApplication | undefined): Promise<void> {
  await app
    ?.evaluate(() => {
      const g = globalThis as unknown as Held
      if (g.__realSetTimeout) globalThis.setTimeout = g.__realSetTimeout
      const held = g.__heldPauses ?? []
      g.__heldPauses = []
      held.forEach((fn) => fn())
    })
    .catch(() => {})
}

const PROMPT = 'Warm light drifts slowly across the sand dunes at dusk'

test('the Generate panel makes a video on the background layer', async () => {
  test.setTimeout(180_000)
  session = await openApp()
  const { app, page, box } = session
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await s.videoWithBackdrop(app, page, 'Dune Light', box.root)
  await s.selectLayer(page, await s.backgroundName(page))
  const panel = page.getByRole('group', { name: 'Generate' })
  const make = panel.getByRole('group', { name: 'Make' })
  await expect(make.getByRole('button', { name: 'Video' })).toHaveAttribute('aria-pressed', 'true')
  await panel.getByRole('textbox', { name: 'Prompt' }).fill(PROMPT)
  await panel.getByRole('radio', { name: "This layer's picture" }).check()
  await shot(page, '330-generate-panel-video')

  await panel.getByRole('button', { name: 'Generate…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Make a video' })
  await dialog.getByRole('radio', { name: 'fal.ai Seedance' }).check()
  await expect(
    dialog.getByText(
      'This will use 1 video generation of 4 seconds with fal.ai Seedance. It sends 1 picture(s).',
    ),
  ).toBeVisible()
  await expect(
    dialog.getByText(
      'fal.ai Seedance makes clips of 4 to 15 seconds, so this one will be 4 seconds.',
    ),
  ).toBeVisible()
  await shot(page, '331-run-dialog-video-fal')
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await expect(dialog).toHaveCount(0)

  await holdPauses(app)
  await panel.getByRole('button', { name: 'Generate…' }).click()
  await dialog.getByRole('radio', { name: 'Fake provider' }).check()
  await dialog.getByRole('button', { name: 'Generate' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(panel.getByText(/^Making the video\. Working, \d+ min\.$/)).toBeVisible()
  await shot(page, '332-generate-panel-video-working')

  await releasePauses(app)
  const done = 'Done. The new clip is on the timeline below, in place of the still.'
  await expect(panel.getByText(done)).toBeVisible({ timeout: 30_000 })
  await expect(panel.getByLabel('Video result')).toBeVisible()
  await expect(s.clipBlocks(page)).toHaveCount(1)
  await expect(timeline(page)).toBeVisible()
  await shot(page, '333-generate-panel-video-done')
})
