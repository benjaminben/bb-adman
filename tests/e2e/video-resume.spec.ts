// P7-24, Phase 7 exit criterion 4: a running video job survives the app process ending. A fake
// run is started from the post's background; once its remote run ID is stored, the app process
// this test launched is killed. A new launch on the same data folder opens the project and the
// run's clip lands on the track. The fake provider's wait cannot be set in the built app (it has
// no test hook), so the run is caught in the job's first poll wait (VIDEO_POLL_MS, 2 s) rather
// than a 10 s fake wait. No paid call; made-up names and a drawn picture only.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import { firstIds } from './held-run'
import { query } from './render-helpers'
import * as screens from './screens'
import * as s from './video-variant-steps'

const NAME = 'Dune Resume'

let box: Sandbox
const launched: ElectronApplication[] = []

test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(async () => {
  try {
    for (const app of launched) await app.close()
  } finally {
    launched.length = 0
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

async function open(): Promise<Page> {
  const app = await launch(box)
  launched.push(app)
  return app.firstWindow()
}

type Job = { kind: string; status: string; remoteJobId: string | null }

async function videoJob(page: Page): Promise<Job | undefined> {
  const { projectId } = await firstIds(page)
  const jobs = (await query(page, 'job.list', { projectId })) as unknown as Job[]
  return jobs.find((j) => j.kind === 'video_generation')
}

// Ends the process and waits until it is gone. Only the app this test launched is killed; it
// leaves the list afterEach closes.
async function kill(app: ElectronApplication): Promise<void> {
  launched.splice(launched.indexOf(app), 1)
  const child = app.process()
  const gone = new Promise((resolve) => child.once('exit', resolve))
  child.kill('SIGKILL')
  await gone
}

test('a video run started before the app process ended lands after the next launch', async () => {
  test.setTimeout(180_000)
  const page = await open()
  const first = launched[0]!
  await s.videoWithBackdrop(first, page, NAME, box.root)
  await expect(s.clipBlocks(page)).toHaveCount(1)

  await s.startFromBackground(page)
  await expect
    .poll(async () => (await videoJob(page))?.remoteJobId ?? null, { intervals: [50] })
    .not.toBeNull()
  const before = await videoJob(page)
  await kill(first)
  expect(before?.status, 'the run was still working when the process ended').toBe('running')

  const again = await open()
  const reopen = again.getByRole('button', { name: new RegExp(`^Open ${NAME}`) })
  if ((await again.getByRole('heading', { name: NAME, level: 1 }).count()) === 0) {
    await reopen.click()
  }
  await expect(again.getByRole('heading', { name: NAME, level: 1 })).toBeVisible()
  await expect
    .poll(async () => (await videoJob(again))?.status, { timeout: 30_000 })
    .toBe('succeeded')
  await screens.openCampaign(again)
  await s.backToEditor(again)
  // R2E-9: the run's clip takes the still's place, so it is the one clip, starting at 0.
  await expect(s.clipBlocks(again)).toHaveCount(1)
  await expect(s.clipBlock(again, 1)).not.toHaveAccessibleName(s.BACKDROP)
  expect(await s.valueOf(s.clipStart(again, 1))).toBe(0)
})
