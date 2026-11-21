// spec/scene.md, "Thumbnails": writing, reading and cleaning touch only regular files directly
// in {userData}/thumbnails/{projectId}/, never through a link (spec/security.md).
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  MAX_THUMBNAIL_BYTES,
  cleanThumbnails,
  readThumbnail,
  removeThumbnail,
  writeThumbnail,
} from '@/main/thumbnails/cache'

const PROJECT = '01HZY3V7Q8R9S0T1V2W3X4Y5Z6'
const PNG = new Uint8Array([137, 80, 78, 71])

let root: string
let userData: string
let dir: string
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-thumbs-'))
  userData = path.join(root, 'userData')
  fs.mkdirSync(userData)
  dir = path.join(userData, 'thumbnails', PROJECT)
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

describe('writing a thumbnail [spec/scene.md, Thumbnails]', () => {
  it('makes the folders and writes the file, with no half-written file left', async () => {
    expect(await writeThumbnail(userData, PROJECT, 'v23456', 3, PNG)).toBe('written')
    expect(fs.readdirSync(dir)).toEqual(['v23456-3.png'])
    expect(new Uint8Array(fs.readFileSync(path.join(dir, 'v23456-3.png')))).toEqual(PNG)
  })

  it('leaves a file already there for that rev as it is', async () => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'v23456-3.png'), 'old')
    expect(await writeThumbnail(userData, PROJECT, 'v23456', 3, PNG)).toBe('kept')
    expect(fs.readFileSync(path.join(dir, 'v23456-3.png'), 'utf8')).toBe('old')
  })

  it.each([
    ['the project folder', 'project'],
    ['the thumbnails folder', 'root'],
  ])('refuses and writes nothing when %s is a link', async (_case, at) => {
    const linkPath = at === 'root' ? path.join(userData, 'thumbnails') : dir
    fs.mkdirSync(path.dirname(linkPath), { recursive: true })
    fs.symlinkSync(outside(), linkPath)
    expect(await writeThumbnail(userData, PROJECT, 'v23456', 3, PNG)).toBe('refused')
    expect(fs.readdirSync(outside())).toEqual([])
  })

  it('throws and touches no file for a bad name', async () => {
    await expect(writeThumbnail(userData, '../x', 'v23456', 3, PNG)).rejects.toThrow()
    await expect(writeThumbnail(userData, PROJECT, '../../a', 3, PNG)).rejects.toThrow()
    expect(fs.existsSync(path.join(userData, 'thumbnails'))).toBe(false)
  })
})

describe('reading a thumbnail [spec/scene.md, Thumbnails]', () => {
  it('reads a regular file and treats a link, a folder or a large file as absent', async () => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'v23456-1.png'), PNG)
    fs.writeFileSync(path.join(outside(), 'secret.png'), PNG)
    fs.symlinkSync(path.join(outside(), 'secret.png'), path.join(dir, 'v23456-2.png'))
    fs.mkdirSync(path.join(dir, 'v23456-3.png'))
    fs.writeFileSync(path.join(dir, 'v23456-4.png'), new Uint8Array(MAX_THUMBNAIL_BYTES + 1))
    expect(await readThumbnail(userData, PROJECT, 'v23456', 1)).toEqual(PNG)
    for (const rev of [2, 3, 4, 5]) {
      expect(await readThumbnail(userData, PROJECT, 'v23456', rev)).toBeNull()
    }
  })

  it('reads nothing through a linked project folder', async () => {
    fs.mkdirSync(path.join(userData, 'thumbnails'))
    fs.writeFileSync(path.join(outside(), 'v23456-1.png'), PNG)
    fs.symlinkSync(outside(), dir)
    expect(await readThumbnail(userData, PROJECT, 'v23456', 1)).toBeNull()
  })
})

describe('removing and cleaning [spec/scene.md, Thumbnails]', () => {
  it('removes one regular thumbnail and leaves a link alone', async () => {
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, 'v23456-1.png'), PNG)
    fs.writeFileSync(path.join(outside(), 'kept.png'), PNG)
    fs.symlinkSync(path.join(outside(), 'kept.png'), path.join(dir, 'v23456-2.png'))
    expect(await removeThumbnail(userData, PROJECT, 'v23456', 1)).toBe(true)
    expect(await removeThumbnail(userData, PROJECT, 'v23456', 2)).toBe(false)
    expect(fs.readdirSync(dir)).toEqual(['v23456-2.png'])
    expect(fs.existsSync(path.join(outside(), 'kept.png'))).toBe(true)
  })

  it('deletes old thumbnails and half-written files, and nothing else', async () => {
    fs.mkdirSync(path.join(dir, 'v23456-9.png'), { recursive: true })
    fs.writeFileSync(path.join(dir, 'v23456-9.png', 'v23456-1.png'), PNG)
    for (const name of ['v23456-1.png', 'v23456-2.png', 'w23456-5.png', 'v23456-1.png.partial']) {
      fs.writeFileSync(path.join(dir, name), PNG)
    }
    fs.writeFileSync(path.join(dir, 'notes.txt'), 'x')
    fs.writeFileSync(path.join(outside(), 'target.png'), PNG)
    fs.symlinkSync(path.join(outside(), 'target.png'), path.join(dir, 'v23456-0.png'))
    const keep = new Set(['v23456-2.png', 'w23456-5.png'])
    expect(await cleanThumbnails(userData, PROJECT, keep)).toBe(2)
    expect(fs.readdirSync(dir).sort()).toEqual(
      ['notes.txt', 'v23456-0.png', 'v23456-2.png', 'v23456-9.png', 'w23456-5.png'].sort(),
    )
    expect(fs.readdirSync(path.join(dir, 'v23456-9.png'))).toEqual(['v23456-1.png'])
    expect(fs.existsSync(path.join(outside(), 'target.png'))).toBe(true)
  })

  it('deletes nothing through a linked project folder', async () => {
    fs.mkdirSync(path.join(userData, 'thumbnails'))
    fs.writeFileSync(path.join(outside(), 'v23456-1.png'), PNG)
    fs.symlinkSync(outside(), dir)
    expect(await cleanThumbnails(userData, PROJECT, new Set())).toBe(0)
    expect(await removeThumbnail(userData, PROJECT, 'v23456', 1)).toBe(false)
    expect(fs.readdirSync(outside())).toEqual(['v23456-1.png'])
  })

  it('does nothing when there is no folder', async () => {
    expect(await cleanThumbnails(userData, PROJECT, new Set())).toBe(0)
  })
})

function outside(): string {
  const o = path.join(root, 'outside')
  fs.mkdirSync(o, { recursive: true })
  return o
}
