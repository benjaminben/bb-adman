import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import { CONTENT_SECURITY_POLICY } from '@/main/windows/csp'

let box: Sandbox
test.beforeEach(() => {
  box = makeSandbox()
})
test.afterEach(() => fs.rmSync(box.root, { recursive: true, force: true }))

test('the built app carries exactly the SPEC 8.2 content security policy', async () => {
  const app = await launch(box)
  const page = await app.firstWindow()
  const policies = await page
    .locator('meta[http-equiv="Content-Security-Policy"]')
    .evaluateAll((nodes) => nodes.map((n) => n.getAttribute('content')))
  expect(policies).toEqual([CONTENT_SECURITY_POLICY])
  await app.close()
})

test('an iframe added to the app page by script does not load a file: page', async () => {
  const app = await launch(box)
  const page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
  await page.evaluate(
    () =>
      new Promise<void>((resolve) => {
        const frame = document.createElement('iframe')
        frame.addEventListener('load', () => resolve())
        setTimeout(resolve, 3000)
        frame.src = location.href
        document.body.append(frame)
      }),
  )
  const childUrls = page
    .frames()
    .filter((f) => f !== page.mainFrame())
    .map((f) => f.url())
  expect(childUrls.length).toBeGreaterThan(0)
  expect(childUrls.filter((url) => url.startsWith('file:'))).toEqual([])
  const filled = await page.evaluate(
    () => document.querySelector('iframe')?.contentDocument?.body?.childElementCount ?? 0,
  )
  expect(filled).toBe(0)
  await app.close()
})
