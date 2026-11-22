// spec/screens-ai.md, "Attached jobs and the close warning", class G: quitting with a run going
// shows the system box "Quit AdManager?"; "Cancel" keeps the app, "Quit" stops the run through
// project.close with 'stop' and quits. With nothing running, no box (every other test quits so).
// The box is answered by quit-answer.ts. The run is held by held-run.ts: no request
// leaves the computer.
import { test, expect } from '@playwright/test'
import Database from 'better-sqlite3'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import * as screens from './screens'
import { firstIds, heldAsked, holdGemini, jobStatus, startHeldRun } from './held-run'
import { answerMessageBox, answerQuit, askedBoxes as asked } from './quit-answer'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

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
    message: 'Quit AdManager?',
    detail:
      '1 run is still going. Quitting stops it. Requests already sent to a paid provider may ' +
      'still be charged, and their results are lost.',
    buttons: ['Quit', 'Cancel'],
  })
  expect(await jobStatus(page, ids.projectId, jobId)).toBe('running')

  await answerQuit(app)
  await app.close()
  expect(storedStatus(ids.filePath, jobId)).toBe('cancelled')
})
