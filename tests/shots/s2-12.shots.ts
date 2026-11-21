// S2-12: the Package section on the project home and the package dialog. Files are imported
// through window.api and packaged into a sandbox folder for real; then their folder is renamed
// on disk, so a second package is refused with the missing files listed.
import { test, expect, type Page } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import * as screens from '../e2e/screens'
import { command, FONT_FILE } from '../e2e/render-helpers'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

// A PNG header of the given size: enough for the import to know the type and the size.
function pngHeader(width: number, height: number): Buffer {
  const head = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
  const size = Buffer.alloc(8)
  size.writeUInt32BE(width, 0)
  size.writeUInt32BE(height, 4)
  return Buffer.concat([head, Buffer.from('IHDR'), size, Buffer.from([8, 6, 0, 0, 0])])
}

function put(folder: string, name: string, bytes: Buffer): string {
  fs.mkdirSync(folder, { recursive: true })
  const file = path.join(folder, name)
  fs.writeFileSync(file, bytes)
  return file
}

async function openProjectId(page: Page): Promise<string> {
  const state = await page.evaluate(() =>
    (window as unknown as { api: { query: (n: string) => Promise<unknown> } }).api.query(
      'app.getState',
    ),
  )
  const open = (state as { data: { openProjects: Array<{ projectId: string }> } }).data
  const projectId = open.openProjects[0]?.projectId
  if (projectId === undefined) throw new Error('No project is open.')
  return projectId
}

test('the Package section and the package dialog', async () => {
  session = await openApp()
  const { app, box, page } = session
  await screens.createProject(page, 'Summer Launch')
  const projectId = await openProjectId(page)

  const summer = path.join(box.root, 'Shoots', 'Summer 2026')
  const paths = [
    put(summer, 'hero-can-sunset.png', pngHeader(2400, 1600)),
    put(summer, 'picnic-table-wide.png', pngHeader(3000, 1688)),
    put(summer, 'beach-mood.png', pngHeader(1200, 900)),
    put(path.join(box.root, 'Fonts'), 'Coastline Sans.woff2', fs.readFileSync(FONT_FILE)),
  ]
  await command(page, 'asset.import', { projectId, paths, library: 'asset', copy: false })

  const open = page.getByRole('button', { name: 'Package project…' })
  await expect(open).toBeVisible()
  await shot(page, '30-project-home-package')

  const handover = path.join(box.root, 'Handover')
  fs.mkdirSync(handover)
  await screens.answerOpenDialog(app, [handover])
  await open.click()
  const dialog = page.getByRole('dialog', { name: 'Package project' })
  await dialog.getByRole('button', { name: 'Choose a folder and package…' }).click()
  await expect(dialog.getByRole('status')).toContainText('The package is ready: 5 file(s)')
  await shot(page, '31-package-dialog-done')
  await dialog.getByRole('button', { name: 'Close' }).click()

  fs.renameSync(path.join(box.root, 'Shoots'), path.join(box.root, 'Shoots (moved)'))
  const second = path.join(box.root, 'Handover 2')
  fs.mkdirSync(second)
  await screens.answerOpenDialog(app, [second])
  await open.click()
  await dialog.getByRole('button', { name: 'Choose a folder and package…' }).click()
  await expect(dialog.getByRole('list', { name: 'Missing files' })).toBeVisible()
  await shot(page, '32-package-dialog-missing')
})
