import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'
import { CONTENT_SECURITY_POLICY } from '../../src/main/windows/csp'

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
