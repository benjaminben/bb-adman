// SH-4 (spec/phases/design-wave-screens-a.md, "SH-4 — Activity panel"): 440 the panel with one
// running and two finished rows (one failed); 441 the empty panel. Gemini is answered by the
// stand-in in p4-14-gemini.ts (a made-up key, `fetch` replaced in the main process: nothing
// leaves the computer and no call is paid): it refuses the first run and holds the second;
// the fake provider gives the finished row.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { MADE_UP_KEY } from '../e2e/gemini-stand-in'
import { firstIds } from '../e2e/held-run'
import { answerQuit } from '../e2e/quit-answer'
import { command, query } from '../e2e/render-helpers'
import { holdGemini, installGemini, releaseGemini } from './p4-14-gemini'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  if (session) {
    await releaseGemini(session.app, 10, 'refuse')
    await answerQuit(session.app)
  }
  await closeApp(session)
  session = undefined
})

async function stillPage(page: Page): Promise<void> {
  await page.addInitScript(() => {
    Math.random = () => 0.3
  })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
}

type Ids = Awaited<ReturnType<typeof firstIds>>

async function runPictures(page: Page, ids: Ids, provider: string, prompt: string) {
  const slots = (await query(page, 'template.slots', {
    projectId: ids.projectId,
    campaignId: ids.campaignId,
  })) as unknown as { slot: { id: string; type: string } }[]
  const slot = slots.find((s) => s.slot.type === 'image') ?? slots[0]!
  await command(page, 'generation.runImages', {
    projectId: ids.projectId,
    variantId: ids.variantId,
    slot: slot.slot.id,
    prompt,
    referenceAssetIds: [],
    count: 1,
    provider,
  })
}

const activity = (page: Page) => page.getByRole('region', { name: 'Activity' })

test('The activity panel with a running row and two finished rows, one failed', async () => {
  test.setTimeout(120_000)
  session = await openApp()
  const { app, page } = session
  await stillPage(page)
  await installGemini(app)
  await screens.createProject(page, 'Alpine Spring')
  await screens.loadBriefAndCreate(app, page)
  const ids = await firstIds(page)
  await command(page, 'secret.set', { name: 'gemini.apiKey', value: MADE_UP_KEY })
  await runPictures(page, ids, 'gemini', 'A mountain lake at dawn, refused')
  await runPictures(page, ids, 'fake', 'A mountain lake at dawn')
  await screens.openActivity(page)
  await expect(activity(page).getByRole('listitem')).toHaveCount(2, { timeout: 15_000 })
  await expect(activity(page).getByText('Failed')).toBeVisible({ timeout: 15_000 })
  await holdGemini(app)
  await runPictures(page, ids, 'gemini', 'A mountain lake at noon')
  await expect(activity(page).getByRole('listitem')).toHaveCount(3, { timeout: 15_000 })
  await expect(page.getByRole('button', { name: /^Activity/ })).toContainText('1 running')
  await page.waitForTimeout(300)
  await shot(page, '440-activity-rows')
})

test('The empty activity panel', async () => {
  session = await openApp()
  const { page } = session
  await stillPage(page)
  await screens.createProject(page, 'Harbour Lights')
  await screens.openActivity(page)
  await expect(activity(page).getByRole('listitem')).toHaveCount(0)
  await page.waitForTimeout(300)
  await shot(page, '441-activity-empty')
})
