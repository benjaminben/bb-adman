import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterAll } from 'vitest'
import { localStorageAt } from '../../../src/main/providers/local-storage'
import { describeStorageConformance } from './storage-conformance'

const folders: string[] = []
afterAll(() => {
  for (const folder of folders) fs.rmSync(folder, { recursive: true, force: true })
})

// A temporary folder holding `root/`, so a test can look just outside the root.
function tempRoot(): { outer: string; root: string } {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-local-storage-'))
  folders.push(outer)
  const root = path.join(outer, 'root')
  fs.mkdirSync(root)
  return { outer, root }
}

describeStorageConformance('local folder', () => localStorageAt(tempRoot().root))

describe('local storage on disk [SPEC 6, 6.5]', () => {
  it('writes the file under its root folder, at the relative path', async () => {
    const { root } = tempRoot()
    await localStorageAt(root).write('a/b/c.txt', new TextEncoder().encode('hi'), 'text/plain')
    expect(fs.readFileSync(path.join(root, 'a', 'b', 'c.txt'), 'utf8')).toBe('hi')
  })

  it('cannot write outside its root folder with ..', async () => {
    const { outer, root } = tempRoot()
    const storage = localStorageAt(root)
    await expect(
      storage.write('../escaped.txt', new Uint8Array([1]), 'text/plain'),
    ).rejects.toThrow(/refused/)
    await expect(
      storage.write('a/../../escaped.txt', new Uint8Array([1]), 'text/plain'),
    ).rejects.toThrow(/refused/)
    expect(fs.existsSync(path.join(outer, 'escaped.txt'))).toBe(false)
  })

  it('cannot write through a folder link that points outside its root', async () => {
    const { outer, root } = tempRoot()
    fs.mkdirSync(path.join(outer, 'elsewhere'))
    fs.symlinkSync(path.join(outer, 'elsewhere'), path.join(root, 'link'), 'dir')
    const storage = localStorageAt(root)
    await expect(storage.write('link/x.txt', new Uint8Array([1]), 'text/plain')).rejects.toThrow(
      /refused/,
    )
    await expect(storage.read('link/x.txt')).rejects.toThrow(/refused/)
    expect(fs.existsSync(path.join(outer, 'elsewhere', 'x.txt'))).toBe(false)
  })

  it('does not remove a file outside its root through a folder link', async () => {
    const { outer, root } = tempRoot()
    fs.mkdirSync(path.join(outer, 'elsewhere'))
    fs.writeFileSync(path.join(outer, 'elsewhere', 'keep.txt'), 'keep')
    fs.symlinkSync(path.join(outer, 'elsewhere'), path.join(root, 'link'), 'dir')
    await expect(localStorageAt(root).remove(['link/keep.txt'])).rejects.toThrow(/refused/)
    expect(fs.existsSync(path.join(outer, 'elsewhere', 'keep.txt'))).toBe(true)
  })

  it('cannot write or read through a file link that points outside its root', async () => {
    const { outer, root } = tempRoot()
    fs.writeFileSync(path.join(outer, 'target.txt'), 'outside')
    fs.symlinkSync(path.join(outer, 'target.txt'), path.join(root, 'f.txt'))
    const storage = localStorageAt(root)
    await expect(storage.write('f.txt', new Uint8Array([1]), 'text/plain')).rejects.toThrow(
      /refused/,
    )
    await expect(storage.read('f.txt')).rejects.toThrow(/refused/)
    expect(fs.readFileSync(path.join(outer, 'target.txt'), 'utf8')).toBe('outside')
  })

  it('lists an empty root as no files', async () => {
    expect(await localStorageAt(tempRoot().root).list('')).toEqual([])
  })

  it('lists a root folder that does not exist yet as no files', async () => {
    const { outer } = tempRoot()
    expect(await localStorageAt(path.join(outer, 'not-made')).list('')).toEqual([])
  })
})

// Whether this platform lets a test make a folder link (SPEC 14 H9: skipped where it cannot).
function canMakeLinks(): boolean {
  const { outer } = tempRoot()
  try {
    fs.symlinkSync(path.join(outer, 'root'), path.join(outer, 'probe'), 'dir')
    return true
  } catch {
    return false
  }
}

describe('local storage makes no folder outside its root [SPEC 6.5 1.14 F-01, H9]', () => {
  it.skipIf(!canMakeLinks())(
    'refuses a write into a new folder behind a link that points outside, and makes nothing there',
    async () => {
      const { outer, root } = tempRoot()
      fs.mkdirSync(path.join(outer, 'elsewhere'))
      fs.symlinkSync(path.join(outer, 'elsewhere'), path.join(root, 'link'), 'dir')
      const storage = localStorageAt(root)
      await expect(
        storage.write('link/new/x.txt', new Uint8Array([1]), 'text/plain'),
      ).rejects.toThrow(/refused/)
      expect(fs.existsSync(path.join(outer, 'elsewhere', 'new'))).toBe(false)
      expect(fs.readdirSync(path.join(outer, 'elsewhere'))).toEqual([])
    },
  )
})

describe('local storage messages hold no path [SPEC 6.5 1.14 H10]', () => {
  it('a read of a file in a folder that is not there names no path', async () => {
    const storage = localStorageAt(tempRoot().root)
    const failure = await storage.read('private-folder/x.txt').catch((error: unknown) => error)
    expect(failure).toBeInstanceOf(Error)
    expect(String((failure as Error).message)).not.toContain('private-folder')
  })

  it('a refused folder link gives exactly "Storage path refused"', async () => {
    const { outer, root } = tempRoot()
    fs.mkdirSync(path.join(outer, 'elsewhere'))
    fs.symlinkSync(path.join(outer, 'elsewhere'), path.join(root, 'private-link'), 'dir')
    const failure = await localStorageAt(root)
      .read('private-link/x.txt')
      .catch((error: unknown) => error)
    expect((failure as Error).message).toBe('Storage path refused')
  })
})
