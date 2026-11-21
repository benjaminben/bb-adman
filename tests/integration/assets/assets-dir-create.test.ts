import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetImport } from '../../../src/main/commands/asset/import'
import { projectSetAssetsDir } from '../../../src/main/commands/project/set-assets-dir'
import { createAssetService } from '../../../src/main/assets/service'
import type { JobService } from '../../../src/main/jobs/types'
import { makeAssetBus, expectRefused } from './asset-bus'
import { testLog } from './test-log'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
let outside: string
const assets = createAssetService()
const ID = '01JD0000000000000000000001'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])
const MESSAGE = 'The assets folder could not be found. Choose the assets folder again.'

const jobs: JobService = {
  enqueue: () => 'job',
  cancel: async () => {},
  cancelAll: async () => {},
  activeCount: () => 0,
  projectOpened: async () => {},
}

beforeEach(() => {
  bus = makeAssetBus([
    assetImport({ now: () => new Date(), log: testLog() }),
    projectSetAssetsDir({ jobs }),
  ])
  dir = path.dirname(bus.project.filePath)
  outside = fs.mkdtempSync(path.join(os.tmpdir(), 'adman-outside-'))
})
afterEach(() => {
  bus.cleanup()
  fs.rmSync(outside, { recursive: true, force: true })
})

// Both stored places, set by plain SQL as a hostile project file could hold them.
const pointOutside = () => {
  const gone = path.join(outside, 'gone', 'Art')
  const set = bus.db.prepare('UPDATE project_meta SET value = ? WHERE key = ?')
  set.run(path.relative(dir, gone), 'assets_dir_rel')
  set.run(gone, 'assets_dir_abs')
}
const picture = () => {
  const p = path.join(dir, 'in', 'hero.png')
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, PNG)
  return p
}
const importCopy = () =>
  bus.user('asset.import', { paths: [picture()], library: 'asset', copy: true })

describe('the assets folder is made only inside the project folder [SPEC 14 1.32 U9, 4.1]', () => {
  it('refuses writeManaged with assets_folder_missing and makes no folder', async () => {
    pointOutside()
    const write = assets.writeManaged(bus.project, { assetId: ID, ext: 'png', bytes: PNG })
    await expect(write).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
      message: MESSAGE,
      details: { reason: 'assets_folder_missing' },
    })
    expect(fs.readdirSync(outside)).toEqual([])
  })

  it('refuses asset.import with copy: true with assets_folder_missing and makes no folder', async () => {
    pointOutside()
    const error = await expectRefused(bus, importCopy, 'RULE_VIOLATION', 'assets_folder_missing')
    expect(error.message).toBe(MESSAGE)
    expect(fs.readdirSync(outside)).toEqual([])
  })

  it('still writes a managed file into a folder outside the project chosen with setAssetsDir', async () => {
    const art = path.join(outside, 'Art')
    fs.mkdirSync(art)
    expect(await bus.user('project.setAssetsDir', { dir: art })).toMatchObject({ ok: true })
    await assets.writeManaged(bus.project, { assetId: ID, ext: 'png', bytes: PNG })
    expect(fs.readdirSync(art)).toEqual([`${ID}.png`])
  })

  it('still makes the default folder on first use, for writeManaged and for a copied import', async () => {
    await assets.writeManaged(bus.project, { assetId: ID, ext: 'png', bytes: PNG })
    expect(fs.readdirSync(path.join(dir, 'P Assets'))).toEqual([`${ID}.png`])
    fs.rmSync(path.join(dir, 'P Assets'), { recursive: true })
    expect(await importCopy()).toMatchObject({ ok: true })
    expect(fs.readdirSync(path.join(dir, 'P Assets'))).toHaveLength(1)
  })
})
