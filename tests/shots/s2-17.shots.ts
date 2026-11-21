// S2-17: the import dialog's done state with the animated-WebP line. The animated WebP is a
// header made in code (an extended header with the animation flag, then an ANIM chunk); import
// reads only its header, so no frame is needed. The PNG is a small one-colour picture.
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

function pngChunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

// A 64 x 64 PNG of one colour.
function png(rgb: [number, number, number]): Buffer {
  const side = 64
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(side, 0)
  ihdr.writeUInt32BE(side, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(side).fill(rgb).flat())])
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([
    signature,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', zlib.deflateSync(Buffer.concat(Array(side).fill(row)))),
    pngChunk('IEND', Buffer.alloc(0)),
  ])
}

function riffChunk(fourcc: string, data: number[]): Buffer {
  const head = Buffer.alloc(8)
  head.write(fourcc, 0, 'ascii')
  head.writeUInt32LE(data.length, 4)
  return Buffer.concat([head, Buffer.from(data)])
}

// A 64 x 64 animated WebP header: VP8X with the animation flag, then ANIM.
function animatedWebp(): Buffer {
  const side = [63, 0, 0]
  const body = Buffer.concat([
    Buffer.from('WEBP', 'ascii'),
    riffChunk('VP8X', [0x12, 0, 0, 0, ...side, ...side]),
    riffChunk('ANIM', [0, 0, 0, 0, 0, 0]),
  ])
  const head = Buffer.alloc(8)
  head.write('RIFF', 0, 'ascii')
  head.writeUInt32LE(body.length, 4)
  return Buffer.concat([head, body])
}

test('the import dialog names an animated WebP', async () => {
  session = await openApp()
  const { app, page, box } = session
  const shoot = path.join(box.root, 'Shoot')
  fs.mkdirSync(shoot)
  const files = [path.join(shoot, 'citrus-can-front.png'), path.join(shoot, 'spinning-can.webp')]
  fs.writeFileSync(files[0]!, png([240, 180, 40]))
  fs.writeFileSync(files[1]!, animatedWebp())
  await screens.createProject(page, 'Summer Launch')

  await screens.answerOpenDialog(app, files)
  await page.getByRole('button', { name: 'Import files…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Import 2 file(s)' })
  await dialog.getByRole('button', { name: 'Import' }).click()
  await expect(dialog.getByText(/holds an animation/)).toBeVisible()
  await shot(page, '27-import-dialog-animated')
})
