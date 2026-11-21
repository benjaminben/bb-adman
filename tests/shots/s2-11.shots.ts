// S2-11: the missing-file line on the project home and the relink dialog. Files are imported
// through window.api, then their folder is renamed on disk; one more import makes the page
// read project.get again, so the line shows. Finding one picture finds its neighbour too.
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

async function importFiles(page: Page, projectId: string, paths: string[], library: string) {
  await command(page, 'asset.import', { projectId, paths, library, copy: false })
}

test('the missing-file line and the relink dialog', async () => {
  session = await openApp()
  const { app, box, page } = session
  await screens.createProject(page, 'Summer Launch')
  const projectId = await openProjectId(page)

  const shoots = path.join(box.root, 'Shoots')
  const summer = path.join(shoots, 'Summer 2026')
  const brand = path.join(box.root, 'Brand')
  await importFiles(
    page,
    projectId,
    [
      put(summer, 'hero-can-sunset.png', pngHeader(2400, 1600)),
      put(summer, 'picnic-table-wide.png', pngHeader(3000, 1688)),
    ],
    'asset',
  )
  await importFiles(
    page,
    projectId,
    [put(summer, 'beach-mood.png', pngHeader(1200, 900))],
    'reference',
  )
  await importFiles(
    page,
    projectId,
    [put(path.join(shoots, 'Fonts'), 'Coastline Sans.woff2', fs.readFileSync(FONT_FILE))],
    'asset',
  )

  fs.renameSync(shoots, path.join(box.root, 'Shoots (moved)'))
  await importFiles(page, projectId, [put(brand, 'logo-mark.png', pngHeader(512, 512))], 'asset')
  await expect(page.getByText('4 file(s) this project links to cannot be found.')).toBeVisible()
  await shot(page, '01-project-home-missing-files')

  await page.getByRole('button', { name: 'Find missing files…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Find missing files' })
  await expect(dialog.getByRole('list', { name: 'Missing files' })).toBeVisible()
  await shot(page, '02-relink-dialog-list')

  const moved = path.join(box.root, 'Shoots (moved)', 'Summer 2026', 'hero-can-sunset.png')
  await screens.answerOpenDialog(app, [moved])
  await dialog.getByRole('button', { name: 'Find hero-can-sunset.png' }).click()
  await expect(dialog.getByRole('status')).toContainText('Found hero-can-sunset.png.')
  await shot(page, '03-relink-dialog-found')
})
