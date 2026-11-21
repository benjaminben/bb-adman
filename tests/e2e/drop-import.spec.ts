// spec/screens-campaign.md "Importing by dropping files" (S2-10, FR-246): a file dropped on
// the project page opens the import dialog, and only "Import" adds it.
import { test, expect, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { dragFiles, writePng } from './drop-files'
import * as screens from './screens'

let box: Sandbox
let app: ElectronApplication
let page: Page

test.describe.configure({ mode: 'serial' })

test.beforeAll(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await app.firstWindow()
  await page.waitForLoadState('domcontentloaded')
})

test.afterAll(async () => {
  await app.close()
  fs.rmSync(box.root, { recursive: true, force: true })
})

test('a dropped file opens the import dialog, and "Import" adds it', async () => {
  await screens.createProject(page, 'Summer Launch')
  const file = path.join(box.root, 'citrus can front.png')
  writePng(file, [240, 180, 40])

  await dragFiles(page, [file], ['dragenter', 'dragover'])
  await expect(page.getByText('Drop to import into Summer Launch')).toBeVisible()

  await dragFiles(page, [file], ['drop'])
  await expect(page.getByText('Drop to import into Summer Launch')).toBeHidden()
  const dialog = page.getByRole('dialog', { name: 'Import 1 file(s)' })
  await expect(dialog.getByText('citrus can front.png')).toBeVisible()
  await expect(dialog.getByText('1 file(s) added.')).toBeHidden()

  await dialog.getByRole('button', { name: 'Import' }).click()
  await expect(dialog.getByText('1 file(s) added.')).toBeVisible()
  await dialog.getByRole('button', { name: 'Done' }).click()
  await expect(dialog).toBeHidden()
})
