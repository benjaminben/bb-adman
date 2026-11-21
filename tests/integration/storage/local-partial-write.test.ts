// P8-2 (spec/phases/phase-08.md "The output folder", A-194): every local storage write goes to
// {name}.partial and is renamed to {name}. A failed write removes its .partial and leaves an
// older file of the name whole; list never shows a .partial.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterAll } from 'vitest'
import { localStorageAt } from '@/main/providers/local-storage'
import { ProviderFailure } from '@/main/providers/types'

const folders: string[] = []
afterAll(() => {
  for (const folder of folders) fs.rmSync(folder, { recursive: true, force: true })
})

function tempRoot(): { outer: string; root: string } {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-partial-'))
  folders.push(outer)
  const root = path.join(outer, 'root')
  fs.mkdirSync(path.join(root, 'a'), { recursive: true })
  return { outer, root }
}

function canMakeLinks(): boolean {
  const { outer } = tempRoot()
  try {
    fs.symlinkSync(path.join(outer, 'root'), path.join(outer, 'probe'), 'dir')
    return true
  } catch {
    return false
  }
}
const links = canMakeLinks()

const REFUSED = 'Storage path refused'
const bytes = (text: string) => new Uint8Array(Buffer.from(text))

function streamOf(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      controller.enqueue(bytes(text))
      controller.close()
    },
  })
}

// A stream that gives some bytes, then fails.
function failingStream(): ReadableStream<Uint8Array> {
  let sent = false
  return new ReadableStream({
    pull(controller) {
      if (sent) {
        controller.error(new Error('the source broke'))
        return
      }
      sent = true
      controller.enqueue(bytes('half'))
    },
  })
}

const read = (file: string) => fs.readFileSync(file, 'utf8')

describe('local storage writes through {name}.partial [P8-2, A-194]', () => {
  it('leaves no .partial after a write of bytes or of a stream', async () => {
    const { root } = tempRoot()
    const storage = localStorageAt(root)
    await storage.write('a/one.txt', bytes('one'), 'text/plain')
    await storage.write('a/two.txt', streamOf('two'), 'text/plain')
    expect(fs.readdirSync(path.join(root, 'a')).sort()).toEqual(['one.txt', 'two.txt'])
    expect(read(path.join(root, 'a', 'two.txt'))).toBe('two')
  })

  it('removes the .partial of a failed stream write and leaves the older file whole', async () => {
    const { root } = tempRoot()
    const file = path.join(root, 'a', 'ad.png')
    fs.writeFileSync(file, 'older')
    const storage = localStorageAt(root)
    await expect(storage.write('a/ad.png', failingStream(), 'image/png')).rejects.toBeInstanceOf(
      ProviderFailure,
    )
    expect(fs.readdirSync(path.join(root, 'a'))).toEqual(['ad.png'])
    expect(read(file)).toBe('older')
  })

  it('replaces a leftover .partial that is a regular file', async () => {
    const { root } = tempRoot()
    fs.writeFileSync(path.join(root, 'a', 'ad.png.partial'), 'leftover')
    await localStorageAt(root).write('a/ad.png', bytes('new'), 'image/png')
    expect(fs.readdirSync(path.join(root, 'a'))).toEqual(['ad.png'])
    expect(read(path.join(root, 'a', 'ad.png'))).toBe('new')
  })

  it.skipIf(!links)('refuses a .partial that is a link and leaves its target alone', async () => {
    const { outer, root } = tempRoot()
    const target = path.join(outer, 'outside.txt')
    fs.writeFileSync(target, 'outside')
    fs.symlinkSync(target, path.join(root, 'a', 'ad.png.partial'))
    const write = localStorageAt(root).write('a/ad.png', bytes('new'), 'image/png')
    await expect(write).rejects.toThrow(REFUSED)
    expect(read(target)).toBe('outside')
    expect(fs.lstatSync(path.join(root, 'a', 'ad.png.partial')).isSymbolicLink()).toBe(true)
    expect(fs.existsSync(path.join(root, 'a', 'ad.png'))).toBe(false)
  })

  it('leaves .partial names out of a listing', async () => {
    const { root } = tempRoot()
    fs.writeFileSync(path.join(root, 'a', 'b.txt'), 'b')
    fs.writeFileSync(path.join(root, 'a', 'c.txt.partial'), 'c')
    fs.writeFileSync(path.join(root, 'top.partial'), 'top')
    const storage = localStorageAt(root)
    expect(await storage.list('')).toEqual(['a/b.txt'])
    expect(await storage.list('a')).toEqual(['a/b.txt'])
  })

  it('replaces an existing regular file of the name', async () => {
    const { root } = tempRoot()
    fs.writeFileSync(path.join(root, 'a', 'ad.png'), 'older')
    await localStorageAt(root).write('a/ad.png', streamOf('newer'), 'image/png')
    expect(read(path.join(root, 'a', 'ad.png'))).toBe('newer')
  })

  it.skipIf(!links)('refuses a link at the name and leaves its target alone', async () => {
    const { outer, root } = tempRoot()
    const target = path.join(outer, 'outside.txt')
    fs.writeFileSync(target, 'outside')
    fs.symlinkSync(target, path.join(root, 'a', 'ad.png'))
    const storage = localStorageAt(root)
    await expect(storage.write('a/ad.png', bytes('new'), 'image/png')).rejects.toThrow(REFUSED)
    expect(read(target)).toBe('outside')
    expect(fs.readdirSync(path.join(root, 'a'))).toEqual(['ad.png'])
  })
})
