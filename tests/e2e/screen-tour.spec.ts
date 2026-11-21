// SPEC 14 1.56 E2E-R reach table, the rows that need no stand-in ComfyUI (1.59 L-12): the
// hand-test storage on this computer, Settings, the Start screen and the project home. The
// hand-test tools are on, so the Hand-test button shows. Everything stays in the sandbox.
import { test, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import {
  agentRunsTour,
  handTestStorage,
  projectHomeTour,
  settingsTour,
  startTour,
} from './screen-tour'

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

test('The other screens of the reach table: hand-test storage, Settings, Start, project home', async () => {
  await handTestStorage(page, box)
  await settingsTour(app, page, box)
  await startTour(app, page, box)
  await projectHomeTour(app, page)
})

test('Settings · Agent runs: one tick per provider, the limit', async () => {
  await agentRunsTour(page, box)
})
