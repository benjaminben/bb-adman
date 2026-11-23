// CW-4 (spec/comfyui-custom.md "Screens", D-104), offline: in Settings, add a fixture workflow
// through the system picker, see its row, rename it, and remove it. The workflow file lands in
// the sandbox's userData and leaves with the remove. No server is contacted.
import { expect, test, type ElectronApplication, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import { makeSandbox, launch, type Sandbox } from './launch'
import { answerOpenDialog } from './screens'
import { openSettingsPage } from './settings-pages'

const FIXTURE = path.resolve('tests/fixtures/comfy-custom/two-refs.json')

let box: Sandbox
let app: ElectronApplication
let page: Page

test.beforeEach(async () => {
  box = makeSandbox()
  app = await launch(box)
  page = await app.firstWindow()
})
test.afterEach(async () => {
  try {
    await app?.close()
  } finally {
    fs.rmSync(box.root, { recursive: true, force: true })
  }
})

const storedFiles = () => {
  const dir = path.join(box.userData, 'comfy-workflows')
  return fs.existsSync(dir) ? fs.readdirSync(dir) : []
}

test('Settings: add a ComfyUI workflow from a file, rename it, remove it', async () => {
  const picked = path.join(box.root, 'Harbour poster.json')
  fs.copyFileSync(FIXTURE, picked)
  await openSettingsPage(page, 'AI services')
  const section = page.getByRole('region', { name: 'ComfyUI workflows' })
  await expect(section.getByText('No workflows added yet.')).toBeVisible()

  await answerOpenDialog(app, [picked])
  await section.getByRole('button', { name: 'Add workflow…' }).click()
  await expect(section.getByText('Added Harbour poster.')).toBeVisible()
  const list = section.getByRole('list', { name: 'Added workflows' })
  await expect(list.getByRole('listitem')).toHaveCount(1)
  await expect(list.getByText('Harbour poster', { exact: true })).toBeVisible()
  expect(storedFiles()).toHaveLength(1)
  await expect(page.locator('body')).not.toContainText(box.root)

  await list.getByRole('button', { name: 'Change' }).click()
  const change = page.getByRole('dialog', { name: 'Change workflow' })
  await change.getByLabel('Name').fill('Harbour poster, two pictures')
  await change.getByRole('button', { name: 'Save' }).click()
  await expect(change).toHaveCount(0)
  await expect(list.getByText('Harbour poster, two pictures', { exact: true })).toBeVisible()

  await list.getByRole('button', { name: 'Remove Harbour poster, two pictures' }).click()
  const remove = page.getByRole('dialog', { name: 'Remove Harbour poster, two pictures?' })
  await expect(remove.getByRole('button', { name: 'Keep' })).toBeFocused()
  await remove.getByRole('button', { name: 'Remove workflow' }).click()
  await expect(section.getByText('No workflows added yet.')).toBeVisible()
  expect(storedFiles()).toEqual([])
})
