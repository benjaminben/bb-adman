import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterAll } from 'vitest'
import { localStorageAt } from '@/main/providers/local-storage'

const folders: string[] = []
afterAll(() => {
  for (const folder of folders) fs.rmSync(folder, { recursive: true, force: true })
})

// A temporary folder holding `root/`, so a test can look just outside the root.
function tempRoot(): { outer: string; root: string } {
  const outer = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-local-links-'))
  folders.push(outer)
  const root = path.join(outer, 'root')
  fs.mkdirSync(root)
  return { outer, root }
}

// Whether this platform lets a test make a folder link (SPEC 14 H17: skipped where it cannot).
function canMakeLinks(): boolean {
  const { outer } = tempRoot()
  try {
    fs.symlinkSync(path.join(outer, 'root'), path.join(outer, 'probe'), 'dir')
    return true
  } catch {
    return false
  }
}

const REFUSED = 'Storage path refused'

describe('local storage refuses a link that points nowhere [SPEC 6.5 1.16 A-02, H17]', () => {
  it.skipIf(!canMakeLinks())(
    'refuses write, read, exists, list and remove through it, and makes nothing at the target',
    async () => {
      const { outer, root } = tempRoot()
      const target = path.join(outer, 'not-there')
      fs.symlinkSync(target, path.join(root, 'link'), 'dir')
      const storage = localStorageAt(root)
      const bytes = new Uint8Array([1])
      await expect(storage.write('link/x.txt', bytes, 'text/plain')).rejects.toThrow(REFUSED)
      await expect(storage.write('link/new/x.txt', bytes, 'text/plain')).rejects.toThrow(REFUSED)
      await expect(storage.read('link/x.txt')).rejects.toThrow(REFUSED)
      await expect(storage.exists('link/x.txt')).rejects.toThrow(REFUSED)
      await expect(storage.list('link')).rejects.toThrow(REFUSED)
      await expect(storage.list('link/deeper')).rejects.toThrow(REFUSED)
      await expect(storage.remove(['link/x.txt'])).rejects.toThrow(REFUSED)
      expect(fs.existsSync(target)).toBe(false)
    },
  )

  it.skipIf(!canMakeLinks())('refuses a link that points nowhere one folder down', async () => {
    const { outer, root } = tempRoot()
    fs.mkdirSync(path.join(root, 'a'))
    fs.symlinkSync(path.join(outer, 'not-there'), path.join(root, 'a', 'link'), 'dir')
    const storage = localStorageAt(root)
    await expect(storage.read('a/link/x.txt')).rejects.toThrow(REFUSED)
    await expect(storage.exists('a/link/x.txt')).rejects.toThrow(REFUSED)
    await expect(storage.list('a/link')).rejects.toThrow(REFUSED)
    await expect(storage.write('a/link/x.txt', new Uint8Array([1]), 'text/plain')).rejects.toThrow(
      REFUSED,
    )
    expect(fs.existsSync(path.join(outer, 'not-there'))).toBe(false)
  })
})
