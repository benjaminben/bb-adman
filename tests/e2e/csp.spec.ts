import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import { makeSandbox, launch, type Sandbox } from './launch'

// SPEC 8.2, line by line. The built page must carry exactly this policy.
const SPEC_8_2_POLICY = [
  "default-src 'self';",
  "img-src 'self' adman-asset: data: blob:;",
  'media-src adman-asset:;',
  "font-src 'self' adman-asset:;",
  "style-src 'self' 'unsafe-inline';",
  "script-src 'self';",
  "connect-src 'none'",
].join(' ')

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
  expect(policies).toEqual([SPEC_8_2_POLICY])
  await app.close()
})
