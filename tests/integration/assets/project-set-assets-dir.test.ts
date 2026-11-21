import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { projectSetAssetsDir } from '@/main/commands/project/set-assets-dir'
import { assetImport } from '@/main/commands/asset/import'
import { createAssetService } from '@/main/assets/service'
import { readMeta } from '@/main/db/meta'
import type { JobService } from '@/main/jobs/types'
import { makeAssetBus, expectRefused } from './asset-bus'
import { insertTestAsset } from './asset-rows'
import { testLog } from './test-log'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
const A = '01JD0000000000000000000001'
const B = '01JD0000000000000000000002'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

const jobsCounting = (count: number): JobService => ({
  enqueue: () => 'job',
  cancel: async () => {},
  cancelAll: async () => {},
  activeCount: () => count,
  projectOpened: async () => {},
  markSeen: () => {},
})
const make = (count: number) =>
  makeAssetBus([
    projectSetAssetsDir({ jobs: jobsCounting(count) }),
    assetImport({ now: () => new Date(), log: testLog() }),
  ])

beforeEach(() => {
  bus = make(0)
  dir = path.dirname(bus.project.filePath)
})
afterEach(() => bus.cleanup())

const put = (rel: string, bytes: Buffer) => {
  const p = path.join(dir, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, bytes)
  return p
}
const folder = (rel: string) => {
  const p = path.join(dir, rel)
  fs.mkdirSync(p, { recursive: true })
  return p
}
const setDir = (d: string) => bus.user('project.setAssetsDir', { dir: d })
const managedRow = (id: string, rel: string) =>
  insertTestAsset(bus.db, { id, storage: 'managed', relPath: rel, absPath: path.join(dir, rel) })
const absOf = (id: string) =>
  (bus.db.prepare('SELECT abs_path FROM asset WHERE id = ?').get(id) as { abs_path: string })
    .abs_path
// Every file and folder but the project file and the log folder.
const listAll = (d: string): string[] =>
  fs
    .readdirSync(d, { recursive: true, encoding: 'utf8' })
    .filter((f) => !f.startsWith('P.adman') && !f.startsWith('logs'))
    .sort()

describe('project.setAssetsDir [SPEC 14, Slice A rulings point 4, A3-2; FR-007, R-07]', () => {
  it('writes the two meta keys and names them', async () => {
    const next = folder(path.join('elsewhere', 'Art'))
    const result = await bus.changed(() => setDir(next))
    expect(result).toEqual({ ok: true, data: { assetsDir: next, repointedAssetIds: [] } })
    expect(readMeta(bus.db)).toMatchObject({
      assetsDirRel: path.join('elsewhere', 'Art'),
      assetsDirAbs: next,
    })
  })

  it('puts a later copied import in the new folder', async () => {
    const next = folder('Art')
    await setDir(next)
    const file = put(path.join('in', 'hero.png'), PNG)
    const r = await bus.user('asset.import', { paths: [file], library: 'asset', copy: true })
    const [id] = (r as { data: { assetIds: string[] } }).data.assetIds
    expect(absOf(id as string)).toBe(path.join(next, `${id}.png`))
  })

  it('leaves old managed files where they are, still found', async () => {
    const old = put(path.join('P Assets', `${A}.png`), PNG)
    managedRow(A, path.join('P Assets', `${A}.png`))
    await setDir(folder('Art'))
    expect(absOf(A)).toBe(old)
    expect(await createAssetService().resolve(bus.project, A)).toBe(old)
  })

  it('picks up managed files of a folder moved by hand, and only those', async () => {
    managedRow(A, path.join('P Assets', `${A}.png`))
    managedRow(B, path.join('P Assets', `${B}.png`))
    const moved = put(path.join('Moved', `${A}.png`), PNG)
    const result = await bus.changed(() => setDir(path.join(dir, 'Moved')))
    expect(result).toMatchObject({ ok: true, data: { repointedAssetIds: [A] } })
    expect(bus.db.prepare('SELECT * FROM asset WHERE id = ?').get(A)).toMatchObject({
      abs_path: moved,
      rel_path: path.join('Moved', `${A}.png`),
      byte_size: PNG.length,
    })
    expect(absOf(B)).toBe(path.join(dir, 'P Assets', `${B}.png`))
  })

  it('moves, copies and deletes no file', async () => {
    put(path.join('P Assets', `${A}.png`), PNG)
    managedRow(A, path.join('P Assets', `${A}.png`))
    put(path.join('Moved', `${B}.png`), PNG)
    const before = listAll(dir)
    await setDir(path.join(dir, 'Moved'))
    expect(listAll(dir)).toEqual(before)
  })
})

describe('project.setAssetsDir refusals [SPEC 4.1, 10.1; SPEC 14, Slice A rulings point 4]', () => {
  it('refuses a folder that is not there with NOT_FOUND', async () => {
    await expectRefused(bus, () => setDir(path.join(dir, 'nowhere')), 'NOT_FOUND')
    expect(fs.existsSync(path.join(dir, 'nowhere'))).toBe(false)
  })

  it('refuses a file with INVALID_INPUT', async () => {
    await expectRefused(bus, () => setDir(put('a.png', PNG)), 'INVALID_INPUT')
  })

  it('refuses a path that is not absolute with INVALID_INPUT', async () => {
    await expectRefused(bus, () => setDir('Art'), 'INVALID_INPUT')
  })

  it('refuses while a job is active with jobs_running', async () => {
    bus.cleanup()
    bus = make(1)
    const next = path.join(path.dirname(bus.project.filePath), 'Art')
    fs.mkdirSync(next)
    const error = await expectRefused(bus, () => setDir(next), 'RULE_VIOLATION', 'jobs_running')
    expect(error.message).toBe(
      'Wait for the running work to finish, then change the assets folder.',
    )
  })
})
