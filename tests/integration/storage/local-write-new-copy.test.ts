// P8-9 (A-193): on a disk without hard links (a FAT or exFAT stick), writeNew falls back to a
// copy that still never replaces a file. The hard link is made to fail here.
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { localStorageAt } from '@/main/providers/local-storage/local-storage'

const folders: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const folder of folders.splice(0)) fs.rmSync(folder, { recursive: true, force: true })
})

function noHardLinks(): string {
  const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adman-copy-')))
  folders.push(root)
  vi.spyOn(fsp, 'link').mockRejectedValue(Object.assign(new Error('no links'), { code: 'EPERM' }))
  return root
}

describe('writeNew without hard links [P8-9, A-193]', () => {
  it('writes a new file by copy and leaves no .partial', async () => {
    const root = noHardLinks()
    expect(await localStorageAt(root).writeNew('c/report.html', new Uint8Array([4, 5]))).toBe(true)
    expect([...fs.readFileSync(path.join(root, 'c', 'report.html'))]).toEqual([4, 5])
    expect(fs.readdirSync(path.join(root, 'c'))).toEqual(['report.html'])
  })

  it('answers false at a taken name and keeps the old file whole', async () => {
    const root = noHardLinks()
    fs.mkdirSync(path.join(root, 'c'))
    fs.writeFileSync(path.join(root, 'c', 'report.html'), 'old')
    expect(await localStorageAt(root).writeNew('c/report.html', new Uint8Array([4]))).toBe(false)
    expect(fs.readFileSync(path.join(root, 'c', 'report.html'), 'utf8')).toBe('old')
    expect(fs.readdirSync(path.join(root, 'c'))).toEqual(['report.html'])
  })
})
