// S2-9: the Files section's import buttons, the import dialog with its choices, and its done
// state with result lines. The pictures are small made-up PNGs written into the sandbox.
import { test, expect } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'
import zlib from 'node:zlib'
import * as screens from '../e2e/screens'
import { closeApp, openApp, shot, type Session } from './shot'

let session: Session | undefined

test.afterEach(async () => {
  await closeApp(session)
  session = undefined
})

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

// A 64 x 64 PNG of one colour, so each file has its own content.
function png(rgb: [number, number, number]): Buffer {
  const side = 64
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(side, 0)
  ihdr.writeUInt32BE(side, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(side).fill(rgb).flat())])
  const raw = Buffer.concat(Array(side).fill(row))
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const PICTURES: Record<string, [number, number, number]> = {
  'citrus-can-front.png': [240, 180, 40],
  'citrus-can-side.png': [230, 150, 30],
  'berry-bottle-hero.png': [150, 40, 90],
  'picnic-table.png': [120, 90, 60],
  'beach-towel-stripes.png': [40, 120, 200],
}

// "Shoot" holds three pictures; "Summer pack" holds all five, a hidden file and a document.
function writeFiles(root: string): { files: string[]; folder: string } {
  const shoot = path.join(root, 'Shoot')
  const folder = path.join(root, 'Summer pack')
  fs.mkdirSync(shoot)
  fs.mkdirSync(folder)
  const names = Object.keys(PICTURES)
  names.forEach((name) => fs.writeFileSync(path.join(folder, name), png(PICTURES[name]!)))
  const files = names.slice(0, 3).map((name) => path.join(shoot, name))
  files.forEach((file) => fs.copyFileSync(path.join(folder, path.basename(file)), file))
  fs.writeFileSync(path.join(folder, '.DS_Store'), 'hidden')
  fs.writeFileSync(path.join(folder, 'shot-list.docx'), 'PK not a picture')
  return { files, folder }
}

test('import buttons, the import dialog and its result', async () => {
  session = await openApp()
  const { app, page, box } = session
  const { files, folder } = writeFiles(box.root)
  await screens.createProject(page, 'Summer Launch')
  await expect(page.getByRole('button', { name: 'Import files…' })).toBeVisible()
  await shot(page, '20-project-home-files')

  await screens.answerOpenDialog(app, files)
  await page.getByRole('button', { name: 'Import files…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import 3 file(s)' })
  await expect(dialog.getByRole('radio').first()).toBeFocused()
  await shot(page, '21-import-dialog-files')

  await dialog.getByRole('button', { name: 'Import' }).click()
  await expect(dialog.getByRole('button', { name: 'Done' })).toBeVisible()
  await shot(page, '22-import-dialog-files-done')
  await dialog.getByRole('button', { name: 'Done' }).click()

  await screens.answerOpenDialog(app, [folder])
  await page.getByRole('button', { name: 'Import a folder…' }).click()
  const folderDialog = page.getByRole('dialog', { name: 'Import a folder' })
  await folderDialog.getByRole('radio', { name: /Reference library/ }).check()
  await folderDialog.getByRole('checkbox').check()
  await shot(page, '23-import-dialog-folder')

  await folderDialog.getByRole('button', { name: 'Import' }).click()
  await expect(folderDialog.getByRole('list', { name: 'Import result' })).toBeVisible()
  await shot(page, '24-import-dialog-folder-done')
})
