import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { projectPackage } from '../../../src/main/commands/project/package'
import { assetImport } from '../../../src/main/commands/asset/import'
import { createAssetService } from '../../../src/main/assets/service'
import { closeProjectFile, openProjectFile } from '../../../src/main/db/project-file'
import { readMeta } from '../../../src/main/db/meta'
import { insertTestAsset } from './asset-rows'
import { makeAssetBus, expectRefused } from './asset-bus'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
const assets = createAssetService()
const GEN = '01JD0000000000000000000007'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3])

beforeEach(() => {
  bus = makeAssetBus([projectPackage(), assetImport({ now: () => new Date() })])
  dir = path.dirname(bus.project.filePath)
})
afterEach(() => bus.cleanup())

const put = (name: string, bytes: Buffer | string) => {
  const p = path.join(dir, 'in', name)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, bytes)
  return p
}
const target = () => {
  const t = path.join(dir, 'out')
  fs.mkdirSync(t, { recursive: true })
  return t
}
const pack = (input: Record<string, unknown>) => bus.user('project.package', input)
const ids = (r: unknown) => (r as { data: { assetIds: string[] } }).data.assetIds

async function threeKinds() {
  const [linked] = ids(
    await bus.user('asset.import', { paths: [put('a.png', PNG)], library: 'asset', copy: false }),
  )
  const [copied] = ids(
    await bus.user('asset.import', {
      paths: [put('b.txt', 'Hello')],
      library: 'asset',
      copy: true,
    }),
  )
  await assets.writeManaged(bus.project, { assetId: GEN, ext: 'png', bytes: new Uint8Array([7]) })
  insertTestAsset(bus.db, {
    id: GEN,
    relPath: path.join('P Assets', `${GEN}.png`),
    absPath: path.join(dir, 'P Assets', `${GEN}.png`),
    storage: 'managed',
  })
  return { linked: linked ?? '', copied: copied ?? '' }
}

describe('project.package [SPEC 3.9, FR-008, R-09]', () => {
  it('opens elsewhere with nothing missing after the originals are gone (exit criterion)', async () => {
    const { linked, copied } = await threeKinds()
    const result = await bus.changed(() => pack({ targetDir: target() }))
    const packaged = path.join(dir, 'out', 'P')
    expect(result).toEqual({
      ok: true,
      data: {
        packagePath: packaged,
        fileCount: 4,
        totalBytes: expect.any(Number),
        skippedAssetIds: [],
      },
    })
    expect(fs.readdirSync(path.join(packaged, 'P Assets')).sort()).toEqual(
      [`${linked}.png`, `${copied}.txt`, `${GEN}.png`].sort(),
    )
    const moved = path.join(path.dirname(dir), `${path.basename(dir)}-moved`)
    fs.renameSync(packaged, moved)
    fs.rmSync(path.join(dir, 'in'), { recursive: true })
    fs.rmSync(path.join(dir, 'P Assets'), { recursive: true })
    const opened = openProjectFile({ filePath: path.join(moved, 'P.adman'), appVersion: '0.1.0' })
    try {
      expect(await assets.missingAssetIds(opened)).toEqual([])
      expect(opened.projectId).not.toBe(bus.projectId)
      expect(readMeta(opened.db).assetsDirRel).toBe('P Assets')
      const row = opened.db.prepare('SELECT * FROM asset WHERE id = ?').get(linked)
      expect(row).toMatchObject({ storage: 'managed', display_name: 'a.png' })
    } finally {
      closeProjectFile(opened)
      fs.rmSync(moved, { recursive: true, force: true })
    }
  })

  it('cancels queued and running jobs in the copy only', async () => {
    bus.db
      .prepare(
        `INSERT INTO job (id, kind, status, provider, model, request, created_at, updated_at)
         VALUES ('j1', 'image_generation', 'running', 'fake', 'm', '{}', 'x', 'x')`,
      )
      .run()
    await pack({ targetDir: target() })
    const copy = openProjectFile({
      filePath: path.join(dir, 'out', 'P', 'P.adman'),
      appVersion: '0.1.0',
    })
    try {
      expect(copy.db.prepare("SELECT status FROM job WHERE id = 'j1'").get()).toEqual({
        status: 'cancelled',
      })
    } finally {
      closeProjectFile(copy)
    }
    expect(bus.db.prepare("SELECT status FROM job WHERE id = 'j1'").get()).toEqual({
      status: 'running',
    })
  })

  it('refuses a missing file with MISSING_FILE and the IDs, and writes nothing', async () => {
    insertTestAsset(bus.db, { id: GEN, relPath: 'gone.png', absPath: path.join(dir, 'gone.png') })
    const error = await expectRefused(bus, () => pack({ targetDir: target() }), 'MISSING_FILE')
    expect(error.details).toEqual({ assetIds: [GEN] })
    expect(fs.readdirSync(path.join(dir, 'out'))).toEqual([])
  })

  it('skips a missing file when asked, leaving its row as it was', async () => {
    insertTestAsset(bus.db, { id: GEN, relPath: 'gone.png', absPath: path.join(dir, 'gone.png') })
    const result = await pack({ targetDir: target(), skipMissing: true })
    expect(result).toMatchObject({ ok: true, data: { fileCount: 1, skippedAssetIds: [GEN] } })
  })

  it('refuses a target whose {Name} folder is there and not empty', async () => {
    fs.mkdirSync(path.join(target(), 'P'))
    fs.writeFileSync(path.join(dir, 'out', 'P', 'x'), 'x')
    await expectRefused(bus, () => pack({ targetDir: path.join(dir, 'out') }), 'RULE_VIOLATION')
  })

  it('refuses a target inside the assets folder', async () => {
    fs.mkdirSync(path.join(dir, 'P Assets', 'inner'), { recursive: true })
    await expectRefused(
      bus,
      () => pack({ targetDir: path.join(dir, 'P Assets', 'inner') }),
      'RULE_VIOLATION',
    )
  })

  it('refuses a target that is not an absolute path, or names nothing', async () => {
    await expectRefused(bus, () => pack({ targetDir: 'out' }), 'INVALID_INPUT')
    await expectRefused(bus, () => pack({ targetDir: path.join(dir, 'nope') }), 'NOT_FOUND')
  })
})

describe('project.package partial folder [SPEC 3.9 step 3]', () => {
  it('refuses when a {Name}.partial folder is in the way, and leaves it alone', async () => {
    fs.mkdirSync(path.join(target(), 'P.partial'))
    fs.writeFileSync(path.join(dir, 'out', 'P.partial', 'keep'), 'x')
    await expectRefused(bus, () => pack({ targetDir: path.join(dir, 'out') }), 'RULE_VIOLATION')
    expect(fs.readdirSync(path.join(dir, 'out', 'P.partial'))).toEqual(['keep'])
  })

  it('deletes the partial folder when a step fails', async () => {
    const real = bus.project.db
    const db = new Proxy(real, {
      get(t, key) {
        if (key === 'backup') return () => Promise.reject(new Error('disk full'))
        const value = Reflect.get(t, key) as unknown
        return typeof value === 'function' ? value.bind(t) : value
      },
    })
    const { packageProject } = await import('../../../src/main/assets/package')
    await expect(packageProject({ ...bus.project, db }, target(), false)).rejects.toThrow(
      'disk full',
    )
    expect(fs.readdirSync(path.join(dir, 'out'))).toEqual([])
  })
})
