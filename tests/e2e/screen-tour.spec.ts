// SPEC 14 1.56 E2E-R reach table, the rows that need no stand-in ComfyUI (1.59 L-12): Settings,
// the Start screen and the project home. The hand-test tools are on, and still no "Hand test"
// button shows: its screen was removed in P9-14. Everything stays in the sandbox.
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import { agentRunsTour, aiTour, projectHomeTour, settingsTour, startTour } from './screen-tour'

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box, [], { ADMAN_DEV_TOOLS: '1' })
  page = await app.firstWindow()
})
test.afterEach(async () => {
  try {
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

test('The other screens of the reach table: Settings, Start, project home', async () => {
  await expect(page.getByRole('button', { name: 'Settings' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Hand test' })).toHaveCount(0)
  await settingsTour(app, page, box)
  await startTour(app, page, box)
  await projectHomeTour(app, page)
})

test('Settings · Agent runs: one tick per provider, the limit', async () => {
  await agentRunsTour(page, box)
})

test('The picture section of a picture layer, and the Activity button and panel', async () => {
  await aiTour(app, page)
})
