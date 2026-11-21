// Drags real files over the window as the system would (spec/screens-campaign.md, "Importing
// by dropping files"). A page-made File has no path, so the files go on a hidden input with
// setInputFiles first; the drag events then carry those File objects. Not a test file itself.
import type { Page } from '@playwright/test'
import fs from 'node:fs'
import zlib from 'node:zlib'

const INPUT = 'drop-files-source'

function chunk(type: string, data: Buffer): Buffer {
  const head = Buffer.alloc(8)
  head.writeUInt32BE(data.length, 0)
  head.write(type, 4, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(zlib.crc32(Buffer.concat([head.subarray(4), data])), 0)
  return Buffer.concat([head, data, crc])
}

// Writes a 64 x 64 PNG of one colour.
export function writePng(file: string, rgb: [number, number, number]): void {
  const side = 64
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(side, 0)
  ihdr.writeUInt32BE(side, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  const row = Buffer.concat([Buffer.from([0]), Buffer.from(Array(side).fill(rgb).flat())])
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const png = Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(Buffer.concat(Array(side).fill(row)))),
    chunk('IEND', Buffer.alloc(0)),
  ])
  fs.writeFileSync(file, png)
}

// Sends the given drag events to the window, carrying the files at these paths.
export async function dragFiles(page: Page, paths: string[], types: string[]): Promise<void> {
  await page.evaluate((id) => {
    document.getElementById(id)?.remove()
    const input = document.createElement('input')
    input.type = 'file'
    input.multiple = true
    input.id = id
    input.hidden = true
    document.body.append(input)
  }, INPUT)
  await page.setInputFiles(`#${INPUT}`, paths)
  await page.evaluate(
    ({ id, types }) => {
      const input = document.getElementById(id) as HTMLInputElement
      const data = new DataTransfer()
      for (const file of Array.from(input.files ?? [])) data.items.add(file)
      input.remove()
      for (const type of types) {
        const event = new DragEvent(type, { bubbles: true, cancelable: true, dataTransfer: data })
        document.body.dispatchEvent(event)
      }
    },
    { id: INPUT, types },
  )
}
