import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

// SPEC 1.3 "App window at launch" [D-031], class G: maximized, never full screen.
test('the app window opens maximized and not full screen', async () => {
  const app = await launch(box)
  await app.firstWindow()
  const state = () =>
    app.evaluate(({ BrowserWindow }) => {
      const [win] = BrowserWindow.getAllWindows()
      return { maximized: win?.isMaximized(), fullScreen: win?.isFullScreen() }
    })
  await expect.poll(async () => (await state()).maximized, { timeout: 10_000 }).toBe(true)
  expect((await state()).fullScreen).toBe(false)
  await app.close()
})
