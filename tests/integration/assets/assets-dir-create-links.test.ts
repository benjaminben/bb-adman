import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetImport } from '../../../src/main/commands/asset/import'
import { createAssetService } from '../../../src/main/assets/service'
import {
  closeProjectFile,
  createProjectFile,
  openProjectFile,
} from '../../../src/main/db/project-file'
import { makeAssetBus, expectRefused } from './asset-bus'
import { testLog } from './test-log'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
let outside: string
const assets = createAssetService()
const ID = '01JD0000000000000000000001'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const REFUSED = {
  code: 'RULE_VIOLATION',
  message: 'The assets folder could not be found. Choose the assets folder again.',
  details: { reason: 'assets_folder_missing' },
}

beforeEach(() => {
  bus = makeAssetBus([assetImport({ now: () => new Date(), log: testLog() })])
  dir = path.dirname(bus.project.filePath)
  outside = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-outside-'))
})
afterEach(() => {
  bus.cleanup()
  fs.rmSync(outside, { recursive: true, force: true })
})

function canLink(): boolean {
  const probe = path.join(dir, 'probe')
  try {
    fs.symlinkSync(outside, probe, 'dir')
    fs.unlinkSync(probe)
    return true
  } catch {
    return false
  }
}

// Both stored places set by plain SQL, as a hostile project file could hold them.
const storeAssetsDir = (rel: string) => {
  const set = bus.db.prepare('UPDATE project_meta SET value = ? WHERE key = ?')
  set.run(rel, 'assets_dir_rel')
  set.run(path.join(outside, 'not-there', 'Art'), 'assets_dir_abs')
}
const write = () => assets.writeManaged(bus.project, { assetId: ID, ext: 'png', bytes: PNG })
const importCopy = () => {
  const p = path.join(dir, 'in', 'hero.png')
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, PNG)
  return bus.user('asset.import', { paths: [p], library: 'asset', copy: true })
}

describe('the assets folder check follows links [SPEC 14 1.34 V1, 1.32 U9]', () => {
  it('refuses a folder under a link that leads outside, for writeManaged and a copied import', async (ctx) => {
    if (!canLink()) ctx.skip()
    fs.symlinkSync(outside, path.join(dir, 'L'), 'dir')
    storeAssetsDir(path.join('L', 'new'))
    await expect(write()).rejects.toMatchObject(REFUSED)
    const error = await expectRefused(bus, importCopy, 'RULE_VIOLATION', 'assets_folder_missing')
    expect(error.message).toBe(REFUSED.message)
    expect(fs.existsSync(path.join(outside, 'new'))).toBe(false)
  })

  it('refuses a link to a place that does not exist and makes nothing at its target', async (ctx) => {
    if (!canLink()) ctx.skip()
    const target = path.join(outside, 'gone')
    fs.symlinkSync(target, path.join(dir, 'L'), 'dir')
    storeAssetsDir('L')
    await expect(write()).rejects.toMatchObject(REFUSED)
    expect(fs.existsSync(target)).toBe(false)
  })

  it('makes the folder under a link to a folder inside the project folder', async (ctx) => {
    if (!canLink()) ctx.skip()
    fs.mkdirSync(path.join(dir, 'real'))
    fs.symlinkSync(path.join(dir, 'real'), path.join(dir, 'L'), 'dir')
    storeAssetsDir(path.join('L', 'new'))
    await write()
    expect(fs.readdirSync(path.join(dir, 'real', 'new'))).toEqual([`${ID}.png`])
  })

  it('refuses when a regular file stands where the assets folder should be', async () => {
    const file = path.join(dir, 'P Assets')
    fs.writeFileSync(file, 'keep me')
    await expect(write()).rejects.toMatchObject(REFUSED)
    expect(fs.readFileSync(file, 'utf8')).toBe('keep me')
  })
})

describe('a project opened through a link to its folder [SPEC 14 1.34 V1]', () => {
  let root: string
  beforeEach(() => {
    root = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-linked-'))
  })
  afterEach(() => fs.rmSync(root, { recursive: true, force: true }))

  it('still makes the default assets folder on first use', async (ctx) => {
    if (!canLink()) ctx.skip()
    const real = path.join(root, 'real')
    fs.mkdirSync(real)
    const made = createProjectFile({
      filePath: path.join(real, 'Q.adman'),
      name: 'Q',
      appVersion: '0.1.0',
      now: 'x',
    })
    closeProjectFile(made)
    fs.symlinkSync(real, path.join(root, 'via'), 'dir')
    const filePath = path.join(root, 'via', 'Q.adman')
    const project = openProjectFile({ filePath, appVersion: '0.1.0' })
    try {
      await assets.writeManaged(project, { assetId: ID, ext: 'png', bytes: PNG })
      expect(fs.readdirSync(path.join(real, 'Q Assets'))).toEqual([`${ID}.png`])
    } finally {
      closeProjectFile(project)
    }
  })
})

describe('a link that leads nowhere, on the way to the assets folder [SPEC 14 1.37 X1]', () => {
  const refusesUnderDeadLink = async (rel: string) => {
    const target = path.join(outside, 'gone')
    const link = path.join(dir, 'L')
    fs.symlinkSync(target, link, 'dir')
    storeAssetsDir(rel)
    await expect(write()).rejects.toMatchObject(REFUSED)
    const error = await expectRefused(bus, importCopy, 'RULE_VIOLATION', 'assets_folder_missing')
    expect(error.message).toBe(REFUSED.message)
    expect(fs.existsSync(target)).toBe(false)
    expect(fs.lstatSync(link).isSymbolicLink()).toBe(true)
  }

  it('refuses L/a/b where L is a link to a place that does not exist', async (ctx) => {
    if (!canLink()) ctx.skip()
    await refusesUnderDeadLink(path.join('L', 'a', 'b'))
  })

  it('refuses L/a where L is a link to a place that does not exist', async (ctx) => {
    if (!canLink()) ctx.skip()
    await refusesUnderDeadLink(path.join('L', 'a'))
  })
})
