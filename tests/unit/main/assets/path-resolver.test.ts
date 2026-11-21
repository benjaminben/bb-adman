import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  assetsDirFor,
  managedPath,
  relativeToProject,
  resolveAssetFile,
} from '@/main/assets/path-resolver'
import { pathAtOrInside } from '@/main/assets/path-resolver'

let root: string
let projectFile: string
beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-resolver-'))
  fs.mkdirSync(path.join(root, 'work'))
  projectFile = path.join(root, 'work', 'P.adman')
})
afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

const put = (p: string) => {
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, 'x')
  return p
}

describe('resolving an asset file: rel_path first, then abs_path [SPEC 3.3 asset, FR-009]', () => {
  it('uses rel_path against the project file folder when that file is there', async () => {
    const rel = put(path.join(root, 'work', 'pics', 'a.png'))
    put(path.join(root, 'old', 'a.png'))
    const found = await resolveAssetFile(projectFile, {
      relPath: path.join('pics', 'a.png'),
      absPath: path.join(root, 'old', 'a.png'),
    })
    expect(found).toBe(rel)
  })

  it('falls back to abs_path when rel_path finds nothing', async () => {
    const abs = put(path.join(root, 'old', 'a.png'))
    const found = await resolveAssetFile(projectFile, {
      relPath: path.join('pics', 'a.png'),
      absPath: abs,
    })
    expect(found).toBe(abs)
  })

  it('says missing when neither is there', async () => {
    const found = await resolveAssetFile(projectFile, {
      relPath: 'gone.png',
      absPath: path.join(root, 'gone.png'),
    })
    expect(found).toBe('missing')
  })

  it('does not take a folder for the file', async () => {
    fs.mkdirSync(path.join(root, 'work', 'dir.png'))
    const found = await resolveAssetFile(projectFile, {
      relPath: 'dir.png',
      absPath: path.join(root, 'work', 'dir.png'),
    })
    expect(found).toBe('missing')
  })
})

describe('the assets folder: assets_dir_rel first, then assets_dir_abs [SPEC 3.3, 3.9]', () => {
  it('uses assets_dir_rel against the project file folder when it is there', () => {
    fs.mkdirSync(path.join(root, 'work', 'P Assets'))
    fs.mkdirSync(path.join(root, 'elsewhere'))
    const dir = assetsDirFor(projectFile, {
      assetsDirRel: 'P Assets',
      assetsDirAbs: path.join(root, 'elsewhere'),
    })
    expect(dir).toBe(path.join(root, 'work', 'P Assets'))
  })

  it('falls back to assets_dir_abs when only that one is there', () => {
    fs.mkdirSync(path.join(root, 'elsewhere'))
    const dir = assetsDirFor(projectFile, {
      assetsDirRel: 'P Assets',
      assetsDirAbs: path.join(root, 'elsewhere'),
    })
    expect(dir).toBe(path.join(root, 'elsewhere'))
  })

  it('gives the assets_dir_rel place when neither is there yet (made on first use)', () => {
    const dir = assetsDirFor(projectFile, {
      assetsDirRel: 'P Assets',
      assetsDirAbs: path.join(root, 'elsewhere'),
    })
    expect(dir).toBe(path.join(root, 'work', 'P Assets'))
  })
})

describe('managed files and relative paths [SPEC 3.3 asset rules]', () => {
  it('names a managed file {assetId}.{ext} in the assets folder', () => {
    expect(managedPath('/a/P Assets', '01JD0000000000000000000001', 'png')).toBe(
      path.join('/a/P Assets', '01JD0000000000000000000001.png'),
    )
  })

  it('gives a path relative to the project file folder', () => {
    const file = path.join(root, 'old', 'a.png')
    expect(relativeToProject(projectFile, file)).toBe(path.join('..', 'old', 'a.png'))
  })
})

describe('a path at or inside a folder [SPEC 14 1.34 pathAtOrInside]', () => {
  const dir = path.join(path.sep, 'a', 'P Assets')

  it('is true for the folder itself', () => {
    expect(pathAtOrInside(dir, dir)).toBe(true)
  })

  it('is true for a child and a deep child', () => {
    expect(pathAtOrInside(dir, path.join(dir, 'b'))).toBe(true)
    expect(pathAtOrInside(dir, path.join(dir, 'b', 'c', 'd'))).toBe(true)
  })

  it('is false for the parent, a sibling and a folder named ..x beside it', () => {
    expect(pathAtOrInside(dir, path.dirname(dir))).toBe(false)
    expect(pathAtOrInside(dir, path.join(path.dirname(dir), 'Other'))).toBe(false)
    expect(pathAtOrInside(dir, path.join(path.dirname(dir), '..x'))).toBe(false)
  })

  it('is true for a child named ..x', () => {
    expect(pathAtOrInside(dir, path.join(dir, '..x'))).toBe(true)
  })
})
