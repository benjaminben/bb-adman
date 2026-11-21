import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

test('the app page is granted no camera', async () => {
  const app = await launch(box)
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  const state = await page.evaluate(async () => {
    const status = await navigator.permissions.query({ name: 'camera' as PermissionName })
    return status.state
  })
  expect(state).not.toBe('granted')
  const refusal = await page.evaluate(() =>
    navigator.mediaDevices.getUserMedia({ video: true }).then(
      (stream) => {
        stream.getTracks().forEach((track) => track.stop())
        return 'granted'
      },
      (error: Error) => error.name,
    ),
  )
  expect(refusal).toBe('NotAllowedError')
  await app.close()
})
