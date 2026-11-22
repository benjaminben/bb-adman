// P8-2 (spec/phases/phase-08.md "The output folder (security)"): every export write goes under
// {root}/{campaignId}/ through exportTarget(root). A link that leads out of the root, at any
// depth, is refused and nothing is written outside; a name that is not a safe relative path
// under a campaign folder is refused before anything is touched.
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
const AD = `${C}/Summer sale-/9x16/en-k3f9q2.png`

// {outer}/root is the output folder; {outer}/outside holds one file and must not change.
function tempRoot(): { root: string; outside: string } {
  const outer = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'adman-target-')))
  folders.push(outer)
  const root = path.join(outer, 'root')
  const outside = path.join(outer, 'outside')
  fs.mkdirSync(root)
  fs.mkdirSync(path.join(outside, 'Summer sale-', '9x16'), { recursive: true })
  fs.writeFileSync(path.join(outside, 'keep.txt'), 'keep')
  return { root, outside }
}

function listing(folder: string): string[] {
  return fs.readdirSync(folder, { recursive: true, encoding: 'utf8' }).sort()
}

function canMakeLinks(): boolean {
  const { root, outside } = tempRoot()
  try {
    fs.symlinkSync(outside, path.join(root, 'probe'), 'dir')
    return true
  } catch {
    return false
  }
}
const links = canMakeLinks()
const bytes = new Uint8Array([1, 2, 3])

describe('exportTarget writes under {root}/{campaignId}/ [P8-2]', () => {
  it('writes an ad at the layout path and answers exists', async () => {
    const { root } = tempRoot()
    const target = exportTarget(root)
    expect(await target.exists(AD)).toBe(false)
    await target.write(AD, bytes)
    expect(await target.exists(AD)).toBe(true)
    expect([...fs.readFileSync(path.join(root, ...AD.split('/')))]).toEqual([1, 2, 3])
  })

  it('turns a safe relative name into the path under the root', () => {
    const { root } = tempRoot()
    const name = `${C}/report-20260105-070809.html`
    expect(exportTarget(root).fullPath(name)).toBe(
      path.join(root, C, 'report-20260105-070809.html'),
    )
  })

  const BAD = [
    'report.html',
    `../${C}/x.png`,
    `${C}/../x.png`,
    `/${C}/x.png`,
    `${C}\\x.png`,
    `${C}/`,
    `Spring-Sale-abc234/x.png`,
    `${C}/a\u0000/x.png`,
    `${C}/CON/x.png`,
    '',
  ]

  it.each(BAD)('refuses %j for write, exists and fullPath, and writes nothing', async (name) => {
    const { root } = tempRoot()
    const target = exportTarget(root)
    await expect(target.write(name, bytes)).rejects.toThrow(new Error(REFUSED_PATH))
    await expect(target.exists(name)).rejects.toThrow(new Error(REFUSED_PATH))
    expect(() => target.fullPath(name)).toThrow(new Error(REFUSED_PATH))
    expect(listing(root)).toEqual([])
  })

  it('refuses a root that is not absolute', () => {
    expect(() => exportTarget('Exports')).toThrow(new Error(REFUSED_PATH))
  })
})

describe('exportTarget never writes outside the root through a link [P8-2]', () => {
  type Case = { name: string; link: (root: string) => string; to: (outside: string) => string }
  const CASES: Case[] = [
    {
      name: '{root}/{campaignId} as a link to a folder outside',
      link: (root) => path.join(root, C),
      to: (outside) => outside,
    },
    {
      name: 'the post folder as a link to a folder outside',
      link: (root) => path.join(root, C, 'Summer sale-'),
      to: (outside) => outside,
    },
    {
      name: 'a link inside the post folder',
      link: (root) => path.join(root, C, 'Summer sale-', '9x16'),
      to: (outside) => path.join(outside, 'Summer sale-', '9x16'),
    },
    {
      name: 'a link at the file itself',
      link: (root) => path.join(root, ...AD.split('/')),
      to: (outside) => path.join(outside, 'keep.txt'),
    },
  ]

  it.skipIf(!links).each(CASES)('$name is refused', async ({ link, to }) => {
    const { root, outside } = tempRoot()
    const before = listing(outside)
    const at = link(root)
    fs.mkdirSync(path.dirname(at), { recursive: true })
    fs.symlinkSync(to(outside), at, fs.statSync(to(outside)).isDirectory() ? 'dir' : 'file')
    await expect(exportTarget(root).write(AD, bytes)).rejects.toThrow(new Error(REFUSED_PATH))
    expect(listing(outside)).toEqual(before)
    expect(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8')).toBe('keep')
  })
})

// P8-9 (P8-2 review L1): before each write the root is checked again: not a link, and its real
// path is the root itself, so a root swapped for a link after checkOutputDir is refused.
describe('exportTarget checks the root again before each write [P8-9]', () => {
  it.skipIf(!links)('refuses a root that has become a link, and writes nothing', async () => {
    const { root, outside } = tempRoot()
    const before = listing(outside)
    fs.rmSync(root, { recursive: true })
    fs.symlinkSync(outside, root, 'dir')
    const target = exportTarget(root)
    await expect(target.write(AD, bytes)).rejects.toThrow(new Error(REFUSED_PATH))
    await expect(target.writeNew(`${C}/r.html`, bytes)).rejects.toThrow(new Error(REFUSED_PATH))
    expect(listing(outside)).toEqual(before)
  })

  it.skipIf(!links)('refuses a root reached through a linked parent folder', async () => {
    const { root } = tempRoot()
    const alias = path.join(path.dirname(root), 'alias')
    fs.symlinkSync(path.dirname(root), alias, 'dir')
    const target = exportTarget(path.join(alias, 'root'))
    await expect(target.write(AD, bytes)).rejects.toThrow(new Error(REFUSED_PATH))
    expect(listing(root)).toEqual([])
  })

  it('refuses a root that is gone with a failure that names no path', async () => {
    const { root } = tempRoot()
    fs.rmSync(root, { recursive: true })
    const error = await exportTarget(root)
      .write(AD, bytes)
      .catch((e: unknown) => e)
    expect(error).toBeInstanceOf(Error)
    expect(JSON.stringify(error) + String(error)).not.toContain(root)
    expect(fs.existsSync(root)).toBe(false)
  })

  it('replaces a hard link at the name and leaves the file outside unchanged', async () => {
    const { root, outside } = tempRoot()
    const file = path.join(root, ...AD.split('/'))
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.linkSync(path.join(outside, 'keep.txt'), file)
    await exportTarget(root).write(AD, bytes)
    expect([...fs.readFileSync(file)]).toEqual([1, 2, 3])
    expect(fs.readFileSync(path.join(outside, 'keep.txt'), 'utf8')).toBe('keep')
  })
})
