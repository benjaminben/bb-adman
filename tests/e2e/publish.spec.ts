// P9-15, Phase 9 exit criterion 2: the built app, with the fake providers on, publishes a
// made-up campaign to the fake storage ({userData}/fake-storage) through the publish dialog,
// in the layout of spec/storage-and-publish.md "Published layout" with manifest.json; the second
// publish shows the replace block, needs the tick, and its manifest says publish 2; a file planted
// in the campaign folder is cleaned up and one planted beside it is not. No bucket, no Dropbox,
// no sign-in, no paid call, no test hook.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { answerQuit } from './quit-answer'
import * as p from './publish-steps'

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await p.appWindow(app)
})
test.afterEach(async () => {
  try {
    await answerQuit(app)
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

type Manifest = {
  campaignId: string
  publishNumber: number
  files: { path: string; bytes: number; sha256: string }[]
}

const manifestOf = (folder: string) =>
  JSON.parse(fs.readFileSync(path.join(folder, 'manifest.json'), 'utf8')) as Manifest

// The dialog closed, the activity list shows `count` publish rows, all of them Done.
async function waitForDone(count: number) {
  const close = /^(Run in background|Close)$/
  await page.getByRole('dialog').getByRole('button', { name: close }).click()
  const panel = page.getByRole('region', { name: 'Activity' })
  if (!(await panel.isVisible())) await p.activityButton(page).click()
  await expect(p.publishRows(page)).toHaveCount(count)
  for (let i = 0; i < count; i++) {
    await expect(p.publishRows(page).nth(i)).toContainText('Done', { timeout: 60_000 })
  }
}

test('Publishing a campaign to the fake storage, then publishing it again', async () => {
  test.setTimeout(180_000)
  const ids = await p.setUpCampaign(page, box.projects)
  const folder = p.fakeFolder(box.userData, ids.campaignId)
  await p.openCampaign(page)

  // The first publish: nothing there yet, the picture listed by name with no path.
  const dialog = await p.openOnFake(page)
  await expect(dialog.getByText('First publish')).toBeVisible()
  const files = dialog.getByRole('list', { name: 'Files' })
  await expect(files.getByRole('listitem')).not.toHaveCount(0)
  await expect(files).not.toContainText('Harbor Day pictures')
  expect(await dialog.innerHTML()).not.toContain(box.projects)
  await p.pressPublish(dialog)
  await waitForDone(1)

  // The documented layout, every file in the manifest, and publish 1.
  const first = p.filesUnder(folder)
  const variant = ids.variantId
  expect(first).toEqual(
    expect.arrayContaining([
      expect.stringMatching(new RegExp(`^exports/[^/]+/1080x1080/en-${variant}\\.png$`)),
      expect.stringMatching(/^exports\/[^/]+\/1080x1080\/de-[0-9A-Za-z]+\.png$/),
      expect.stringMatching(/^components\/images\/[^/]+-[0-9A-Za-z]{8}\.png$/),
      'translations.csv',
      'report.html',
      'report.json',
      'manifest.json',
    ]),
  )
  const one = manifestOf(folder)
  expect(one.campaignId).toBe(ids.campaignId)
  expect(one.publishNumber).toBe(1)
  expect(one.files.map((f) => f.path).sort()).toEqual(first.filter((f) => f !== 'manifest.json'))

  // A file in the campaign folder that the next manifest will not hold, and one beside it.
  const stale = path.join(folder, 'components', 'images', 'left-from-before.png')
  const beside = path.join(box.userData, 'fake-storage', 'beside-the-campaign.txt')
  fs.writeFileSync(stale, 'made-up')
  fs.writeFileSync(beside, 'made-up')

  // The second publish: the replace notice, Publish only once the "Replace" switch is on.
  const again = await p.openOnFake(page)
  await expect(again.getByText(/^Replaces publish 1 · /)).toBeVisible()
  const publish = again.getByRole('button', { name: 'Publish', exact: true })
  await expect(publish).toBeDisabled()
  await again.getByRole('switch', { name: 'Replace the published files' }).check()
  await p.pressPublish(again)
  await waitForDone(2)

  expect(manifestOf(folder).publishNumber).toBe(2)
  expect(fs.existsSync(stale)).toBe(false)
  expect(fs.readFileSync(beside, 'utf8')).toBe('made-up')
  expect(p.filesUnder(folder)).toEqual(first)
})
