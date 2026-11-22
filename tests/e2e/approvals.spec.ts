// AP-13, offline (spec/phases/approvals.md, exit criteria): the built app against the approvals
// stand-in on 127.0.0.1 and the test picture store (dev tools on). Settings, make a link, the
// gallery, a sign-off planted in the stand-in, Refresh, the marks; an edit, "Changed since
// published" and no sign-off (R-10), "Update gallery", still none. People are made up, at
// example.com.
import { test, expect, type ElectronApplication } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from './screens'
import { makeSandbox, launch, type Sandbox } from './launch'
import { startApprovalsStandIn, type ApprovalsStandIn } from '../helpers/approvals-stand-in'
import * as steps from '../approvals-local/app-steps'

// Made up for this run; the stand-in is told to accept it.
const KEY = 'made-up-approvals-e2e-key-for-ap-13-R8VD'

let box: Sandbox
let app: ElectronApplication | undefined
let stand: ApprovalsStandIn | undefined

test.afterEach(async () => {
  try {
    await app?.close()
  } finally {
    app = undefined
    await stand?.close()
    stand = undefined
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

// The one link the stand-in holds, and a sign-off on its first variant at the gallery's version.
function plantSignoff(on: ApprovalsStandIn) {
  const [pair, link] = [...on.links.entries()][0] ?? []
  const first = link?.gallery[0]
  if (pair === undefined || first === undefined) throw new Error('no gallery on the stand-in')
  const [projectId = '', campaignId = ''] = pair.split('/')
  on.plantSignoff(projectId, campaignId, {
    id: 'Ap13kPq7mZt2vWx9bLn3cRd8',
    variantKey: first.variantKey,
    version: first.version,
    email: 'reviewer@example.com',
    signedAt: new Date().toISOString(),
  })
  return first
}

test('link, gallery, sign-off, edit, update: the marks and the earlier-version line', async () => {
  box = makeSandbox()
  const pictures = path.join(box.userData, 'approvals-test-pictures')
  stand = await startApprovalsStandIn({ key: KEY, pictures })
  app = await launch(box, [], {
    ADMAN_DEV_TOOLS: '1',
    ADMAN_APPROVALS_TEST_PICTURES: stand.origin,
  })
  const page = await app.firstWindow()
  await steps.setUpSettings(page, stand.origin, KEY)
  await screens.createProject(page, 'Approvals Check')
  await screens.loadBriefAndCreate(app, page)
  await screens.openCampaign(page)

  const address = await steps.makeLink(page)
  const [link] = [...stand.links.values()]
  expect(address).toBe(`${stand.origin}/l/${link?.slug}`)
  expect(link?.password).toBe(steps.LINK_PASSWORD)
  // The gallery's picture is on the test picture store, served by the stand-in.
  const first = plantSignoff(stand)
  expect(first.pictureUrl.startsWith(`${stand.origin}/adman-approvals/`)).toBe(true)
  const picture = await fetch(first.pictureUrl)
  expect(picture.status).toBe(200)
  expect([...new Uint8Array(await picture.arrayBuffer()).slice(1, 4)]).toEqual([80, 78, 71])

  await steps.refresh(page)
  await expect(steps.bar(page).getByText('Signed off: 1 of 1 variant')).toBeVisible()
  await expect(steps.grid(page).getByText('Signed off by 1')).toBeVisible()

  await steps.editVariant(page)
  // R-10: the edit leaves the sign-off on an older version, so the app shows none at once.
  await expect(steps.grid(page).getByText('Changed since published')).toBeVisible()
  await expect(steps.grid(page).getByText('Signed off by 1')).toHaveCount(0)
  await expect(steps.grid(page).getByRole('button', { name: /^Sign-offs/ })).toHaveCount(0)

  const dialog = await steps.updateGallery(page)
  const updated = stand.links.get([...stand.links.keys()][0] ?? '')?.gallery[0]
  expect(updated?.title).toBe(steps.EDITED_TITLE)
  expect(updated?.version).not.toBe(first.version)
  await expect(dialog.getByText('No sign-offs yet.')).toBeVisible()
  await expect(dialog.getByText(/reviewer@example\.com/)).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Close' }).click()

  await expect(steps.bar(page).getByText('Signed off: 0 of 1 variant')).toBeVisible()
  const marks = steps.grid(page)
  await expect(marks.getByText(/earlier version|Changed since/i)).toHaveCount(0)
  await expect(marks.getByRole('button', { name: /^Sign-offs/ })).toHaveCount(0)
  await expect(marks.getByText(/reviewer@example\.com/)).toHaveCount(0)
})
