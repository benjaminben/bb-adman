// P9-15: a publish to the fake storage, seen in the activity list while it runs and once it is
// done. One made-up campaign with one picture and a German post (tests/e2e/publish-steps.ts).
// Only the fake storage is used, a folder in the sandbox: no bucket, no Dropbox, no sign-in,
// nothing paid. 279 uses one large size so the export runs long enough to be seen.
import { test, expect } from '@playwright/test'
import * as p from '../e2e/publish-steps'
import { answerQuit } from '../e2e/quit-answer'
import { closeApp, openApp, shot, type Session } from './shot'

const POSTER = { label: '4000x4000', width: 4000, height: 4000 }

let session: Session | undefined

// 279 may end with the publish still running: "Quit" is answered first, as in the e2e tests.
test.afterEach(async () => {
  if (session) await answerQuit(session.app)
  await closeApp(session)
  session = undefined
})

async function startPublish(session: Session) {
  const { page } = session
  await p.openCampaign(page)
  const dialog = await p.openOnFake(page)
  await p.pressPublish(dialog)
  await dialog.getByRole('button', { name: 'Close' }).click()
  await p.activityButton(page).click()
}

test('279 a publish running, in the activity list', async () => {
  test.setTimeout(120_000)
  session = await openApp()
  await p.setUpCampaign(session.page, session.box.projects, POSTER)
  await startPublish(session)
  await expect(p.publishRows(session.page).first()).toContainText('Working')
  await shot(session.page, '279-publish-running')
})

test('280 a publish done, in the activity list', async () => {
  test.setTimeout(120_000)
  session = await openApp()
  await p.setUpCampaign(session.page, session.box.projects)
  await startPublish(session)
  await expect(p.publishRows(session.page).first()).toContainText('Done', { timeout: 60_000 })
  await shot(session.page, '280-publish-done')
})
