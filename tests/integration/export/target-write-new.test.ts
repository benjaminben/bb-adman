// P8-9 (spec/phases/phase-08.md "The output folder", overwrite rule, A-193): a report never
// replaces a file. exportTarget(root).writeNew writes through {name}.partial like write, then
// puts the file at the name only if the name is free, so a file that appears between exists()
// and the write is left whole. It answers false when the name is taken.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, afterAll } from 'vitest'
import { exportTarget } from '@/main/export/target'
import { REFUSED_PATH } from '@/main/providers/storage-paths'

const folders: string[] = []
afterAll(() => {
  for (const folder of folders) fs.rmSync(folder, { recursive: true, force: true })
})

const C = 'spring-sale-abc234'
const NAME = `${C}/report-20260105-070809.html`

function tempRoot(): string {
  const outer = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adman-write-new-')))
  folders.push(outer)
  const root = path.join(outer, 'root')
  fs.mkdirSync(path.join(root, C), { recursive: true })
  return root
}

const at = (root: string) => path.join(root, ...NAME.split('/'))
const listing = (root: string) => fs.readdirSync(path.join(root, C)).sort()

describe('exportTarget.writeNew never replaces a file [P8-9, A-193]', () => {
  it('writes a new file at a free name and leaves no .partial', async () => {
    const root = tempRoot()
    expect(await exportTarget(root).writeNew(NAME, new Uint8Array([1, 2]))).toBe(true)
    expect([...fs.readFileSync(at(root))]).toEqual([1, 2])
    expect(listing(root)).toEqual(['report-20260105-070809.html'])
  })

  it('answers false at a taken name, keeps the old file whole and leaves no .partial', async () => {
    const root = tempRoot()
    fs.writeFileSync(at(root), 'old report')
    expect(await exportTarget(root).writeNew(NAME, new Uint8Array([1, 2]))).toBe(false)
    expect(fs.readFileSync(at(root), 'utf8')).toBe('old report')
    expect(listing(root)).toEqual(['report-20260105-070809.html'])
  })

  it('answers false when a folder holds the name, and changes nothing in it', async () => {
    const root = tempRoot()
    fs.mkdirSync(at(root))
    fs.writeFileSync(path.join(at(root), 'inside.txt'), 'keep')
    expect(await exportTarget(root).writeNew(NAME, new Uint8Array([1]))).toBe(false)
    expect(fs.readdirSync(at(root))).toEqual(['inside.txt'])
  })

  it('leaves whole a file that appears after exists() said the name was free', async () => {
    const root = tempRoot()
    const target = exportTarget(root)
    expect(await target.exists(NAME)).toBe(false)
    fs.writeFileSync(at(root), 'someone else')
    expect(await target.writeNew(NAME, new Uint8Array([1]))).toBe(false)
    expect(fs.readFileSync(at(root), 'utf8')).toBe('someone else')
  })

  it('refuses a link at the name and leaves its target alone', async () => {
    const root = tempRoot()
    const outside = path.join(path.dirname(root), 'outside.txt')
    fs.writeFileSync(outside, 'keep')
    try {
      fs.symlinkSync(outside, at(root), 'file')
    } catch {
      return
    }
    await expect(exportTarget(root).writeNew(NAME, new Uint8Array([1]))).rejects.toThrow(
      new Error(REFUSED_PATH),
    )
    expect(fs.readFileSync(outside, 'utf8')).toBe('keep')
  })

  it('refuses a name that is not under a campaign folder before touching anything', async () => {
    const root = tempRoot()
    await expect(exportTarget(root).writeNew('report.html', new Uint8Array([1]))).rejects.toThrow(
      new Error(REFUSED_PATH),
    )
    expect(fs.readdirSync(root)).toEqual([C])
  })
})
