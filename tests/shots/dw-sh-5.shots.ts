// SH-5 (spec/phases/design-wave-screens-a.md, "SH-5 — One close question"): 442 the project
// close question with a run going and a paid video left running. The two running runs are
// Gemini picture runs held by held-run.ts (made-up key, `fetch` replaced in the main process:
// nothing leaves the computer and no call is paid). A started fal video cannot exist without a
// paid run, so in the main process job.activity answers one held run's row drawn as a started
// fal.ai Seedance video (stage working), which the close question reads as left running.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
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

// job.activity draws the given job as a started fal.ai Seedance video run.
async function showAsStartedVideo(app: ElectronApplication, jobId: string): Promise<void> {
  await app.evaluate(({ ipcMain }, id) => {
    type Handler = (event: unknown, ...args: unknown[]) => unknown
    type Answer = { ok: boolean; data?: { job: Record<string, unknown> }[] }
    const handlers = (ipcMain as unknown as { _invokeHandlers: Map<string, Handler> })
      ._invokeHandlers
    const query = handlers.get('adman:query')
    if (query === undefined) throw new Error('no query handler')
    handlers.set('adman:query', async (event, name, input) => {
      const answer = (await query(event, name, input)) as Answer
      if (name !== 'job.activity' || !answer.ok || !answer.data) return answer
      const video = {
        kind: 'video_generation',
        provider: 'fal-seedance',
        remoteJobId: 'made-up-request',
        result: { stage: 'working' },
      }
      const data = answer.data.map((row) =>
        row.job.id === id ? { ...row, job: { ...row.job, ...video } } : row,
      )
      return { ...answer, data }
    })
  }, jobId)
}

test('The project close question with a paid video left running', async () => {
  test.setTimeout(120_000)
  session = await openApp()
  const { app, page } = session
  await stillPage(page)
  await holdGemini(app)
  await screens.createProject(page, 'Alpine Spring')
  await screens.loadBriefAndCreate(app, page)
  const ids = await firstIds(page)
  const first = await startHeldRun(page, ids)
  const second = await startHeldRun(page, ids)
  for (const jobId of [first, second])
    await expect.poll(() => jobStatus(page, ids.projectId, jobId)).toBe('running')
  await showAsStartedVideo(app, second)

  await page.getByRole('button', { name: 'Alpine Spring', exact: true }).click()
  await page.getByRole('menuitem', { name: 'Close Alpine Spring' }).click()
  const dialog = page.getByRole('dialog', { name: 'Close Alpine Spring?' })
  await expect(dialog.getByText(/fal\.ai Seedance has started 1 video/)).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'Keep open' })).toBeFocused()
  await page.mouse.move(5, 5)
  await page.waitForTimeout(300)
  await shot(page, '442-project-close-question')
  await dialog.getByRole('button', { name: 'Keep open' }).click()
})
