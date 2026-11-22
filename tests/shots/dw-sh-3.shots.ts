// SH-3 (spec/phases/design-wave-screens-a.md, "SH-3 — The project menu"): 439 the project menu
// with two projects open, the shown one running. The run is a Gemini picture run held by
// held-run.ts (made-up key, `fetch` replaced in the main process: nothing leaves the computer
// and no call is paid), as p4-10.shots.ts does.
import { test, expect, type Page } from '@playwright/test'
import * as screens from '../e2e/screens'
import { answerQuit } from '../e2e/quit-answer'
import { firstIds, holdGemini, jobStatus, startHeldRun } from '../e2e/held-run'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  if (session) await answerQuit(session.app)
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

test('The project menu with two projects, one running', async () => {
  test.setTimeout(120_000)
  session = await openApp()
  const { app, page } = session
  await stillPage(page)
  await holdGemini(app)
  await screens.createProject(page, 'Harbour Lights')
  await screens.createProject(page, 'Alpine Spring')
  await screens.loadBriefAndCreate(app, page)
  const ids = await firstIds(page)
  const jobId = await startHeldRun(page, ids)
  await expect.poll(() => jobStatus(page, ids.projectId, jobId)).toBe('running')

  await page.getByRole('button', { name: 'Alpine Spring 2 projects open' }).click()
  const menu = page.getByRole('menu')
  await expect(menu.getByTitle('Running')).toBeVisible()
  await expect(menu.getByRole('menuitem', { name: 'Close Harbour Lights' })).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '439-project-menu')
})
