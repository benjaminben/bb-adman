// spec/screens-ai.md, "Attached jobs and the close warning", class G: quitting with a run going
// shows the system box "Quit Adman?"; "Cancel" keeps the app, "Quit" stops the run through
// project.close with 'stop' and quits. With nothing running, no box (every other test quits so).
// The box cannot be clicked, so Electron's dialog.showMessageBox is replaced in the main
// process, as screens.ts replaces the file dialog. The run is held by held-run.ts: no request
// leaves the computer.
import { test, expect, type ElectronApplication } from '@playwright/test'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import * as screens from './screens'
import { firstIds, heldAsked, holdGemini, jobStatus, startHeldRun } from './held-run'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

type Asked = { message: string; detail: string; buttons: string[] }

// The next message boxes answer with `response`; each one asked is kept for the test.
async function answerMessageBox(app: ElectronApplication, response: number): Promise<void> {
  await app.evaluate(({ dialog }, answer) => {
    const kept = globalThis as unknown as { asked?: unknown[] }
    kept.asked ??= []
    dialog.showMessageBox = (async (...args: unknown[]) => {
      kept.asked?.push(args.at(-1))
      return { response: answer, checkboxChecked: false }
    }) as unknown as typeof dialog.showMessageBox
  }, response)
}

const asked = (app: ElectronApplication) =>
  app.evaluate(() => (globalThis as unknown as { asked?: Asked[] }).asked ?? [])

// The run's row as the closed file holds it.
function storedStatus(filePath: string, jobId: string): string | undefined {
  const db = new Database(filePath, { readonly: true })
  try {
    const row = db.prepare('SELECT status FROM job WHERE id = ?').get(jobId) as
      { status: string } | undefined
    return row?.status
  } finally {
    db.close()
  }
}

test('quitting with a run going asks first; Cancel keeps the app, Quit stops the run', async () => {
  const app = await launch(box)
  const page = await app.firstWindow()
  await holdGemini(app)
  await screens.createProject(page, 'Quit Check')
  await screens.loadBriefAndCreate(app, page)
  const ids = await firstIds(page)
  const jobId = await startHeldRun(page, ids)
  await expect.poll(() => jobStatus(page, ids.projectId, jobId)).toBe('running')
  expect(await heldAsked(app)).not.toHaveLength(0)

  await answerMessageBox(app, 1)
  await app.evaluate(({ app: electronApp }) => electronApp.quit())
  await expect.poll(async () => (await asked(app)).length).toBe(1)
  expect((await asked(app))[0]).toMatchObject({
    message: 'Quit Adman?',
    detail:
      '1 run is still going. Quitting stops it. Requests already sent to a paid provider may ' +
      'still be charged, and their results are lost.',
    buttons: ['Quit', 'Cancel'],
  })
  expect(await jobStatus(page, ids.projectId, jobId)).toBe('running')

  await answerMessageBox(app, 0)
  await app.close()
  expect(storedStatus(ids.filePath, jobId)).toBe('cancelled')
})
