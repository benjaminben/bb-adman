import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { projectPackage } from '../../../src/main/commands/project/package'
import { insertTestAsset } from './asset-rows'
import { makeAssetBus, expectRefused } from './asset-bus'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
const BAD = '../x'
const GOOD = '01JD0000000000000000000007'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

const put = (rel: string) => {
  const p = path.join(dir, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, PNG)
  return p
}

// A row whose id cannot form a file name, written by plain SQL as a hostile project file
// could hold it, pointing at a real PNG file, beside one good asset.
beforeEach(() => {
  bus = makeAssetBus([projectPackage()])
  dir = path.dirname(bus.project.filePath)
  fs.mkdirSync(path.join(dir, 'out'))
  const bad = put(path.join('in', 'bad.png'))
  const good = put(path.join('in', 'good.png'))
  insertTestAsset(bus.db, { id: BAD, relPath: path.relative(dir, bad), absPath: bad })
  insertTestAsset(bus.db, { id: GOOD, relPath: path.relative(dir, good), absPath: good })
})
afterEach(() => bus.cleanup())

const pack = (skipMissing: boolean) =>
  bus.user('project.package', { targetDir: path.join(dir, 'out'), skipMissing })
const listOf = (p: string) => fs.readdirSync(p).sort()
// The bus fixture's activity log folder appears on the first command; Package does not make it.
const projectFolder = () => listOf(dir).filter((n) => n !== 'logs')

describe('project.package and a row whose id cannot form a file name [SPEC 14 1.34 V2]', () => {
  it('refuses with MISSING_FILE naming the row, and makes nothing in or outside the target', async () => {
    const before = projectFolder()
    const error = await expectRefused(bus, () => pack(false), 'MISSING_FILE')
    expect(error.details).toEqual({ assetIds: [BAD] })
    expect(listOf(path.join(dir, 'out'))).toEqual([])
    expect(projectFolder()).toEqual(before)
  })

  it('with skipMissing, leaves the row out, keeps the good asset and writes only inside {Name}', async () => {
    const before = projectFolder()
    expect(await pack(true)).toMatchObject({
      ok: true,
      data: { fileCount: 2, skippedAssetIds: [BAD] },
    })
    expect(listOf(path.join(dir, 'out'))).toEqual(['P'])
    expect(listOf(path.join(dir, 'out', 'P', 'P Assets'))).toEqual([`${GOOD}.png`])
    expect(projectFolder()).toEqual(before)
    expect(fs.existsSync(path.join(dir, 'out', 'P', 'x.png'))).toBe(false)
  })
})
