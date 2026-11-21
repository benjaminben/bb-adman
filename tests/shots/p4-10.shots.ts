// P4-10: the close warnings. The campaign comes from the e2e brief. A Gemini picture run is held
// running (tests/e2e/held-run.ts: no request leaves the computer), then "Close project" from
// the project switcher asks "Close {project}?" with the run count.
// The variant tab warnings (70, 71) need an attached job registered in the window, which no
// screen starts yet; they are taken in P4-16 and P4-17.
import { test, expect } from '@playwright/test'
import * as screens from '../e2e/screens'
import { firstIds, holdGemini, startHeldRun, jobStatus } from '../e2e/held-run'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

test('Closing a project with a run going', async () => {
  session = await openApp()
  const { app, page } = session
  await holdGemini(app)
  await screens.createProject(page, 'Alpine Spring')
  await screens.loadBriefAndCreate(app, page)
  const ids = await firstIds(page)
  const jobId = await startHeldRun(page, ids)
  await expect.poll(() => jobStatus(page, ids.projectId, jobId)).toBe('running')

  await page.locator('header button[aria-haspopup="menu"]').click()
  await page.getByRole('menuitem', { name: 'Close project' }).click()
  const dialog = page.getByRole('dialog', { name: 'Close Alpine Spring?' })
  await expect(dialog).toBeVisible()
  await page.waitForTimeout(300)
  await shot(page, '72-close-project-runs-going')

  await dialog.getByRole('button', { name: 'Stop runs and close' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel('Project name')).toBeVisible()
})
