import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { createAssetService } from '../../../src/main/assets/service'
import { makeAssetBus } from './asset-bus'

// Two writers, as two pictures of one job: both find no assets folder, one makes it, and the
// other must then use it, not refuse it as "something in the way" (SPEC 14 [1.37] X1, U9).
// The stat stand-in plays the other writer: it makes the folder just after its answer.
let bus: ReturnType<typeof makeAssetBus>
const assets = createAssetService()
const ID = '01JD0000000000000000000001'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

function folderMadeRightAfterStat(dir: string) {
  const real = fs.promises.stat.bind(fs.promises)
  return vi.spyOn(fs.promises, 'stat').mockImplementation(async (p, opts) => {
    if (p !== dir) return real(p, opts)
    const answer = await real(p, opts).catch(() => null)
    fs.mkdirSync(dir, { recursive: true })
    if (answer) return answer
    throw Object.assign(new Error(`ENOENT: no such file or directory, stat '${dir}'`), {
      code: 'ENOENT',
    })
  })
}

beforeEach(() => {
  bus = makeAssetBus([])
})
afterEach(() => {
  vi.restoreAllMocks()
  bus.cleanup()
})

describe('an assets folder made by another writer in between is used [SPEC 14 1.37 X1; 6.2]', () => {
  it('writeManaged writes the file when the folder appears after its stat', async () => {
    const dir = assets.assetsDir(bus.project)
    folderMadeRightAfterStat(dir)
    await assets.writeManaged(bus.project, { assetId: ID, ext: 'png', bytes: PNG })
    expect(fs.readFileSync(path.join(dir, `${ID}.png`))).toEqual(PNG)
  })

  it('a file that appears in its place after the stat is still refused', async () => {
    const dir = assets.assetsDir(bus.project)
    const real = fs.promises.stat.bind(fs.promises)
    vi.spyOn(fs.promises, 'stat').mockImplementation(async (p, opts) => {
      if (p !== dir) return real(p, opts)
      fs.writeFileSync(dir, 'not a folder')
      throw Object.assign(new Error('ENOENT'), { code: 'ENOENT' })
    })
    const write = assets.writeManaged(bus.project, { assetId: ID, ext: 'png', bytes: PNG })
    await expect(write).rejects.toMatchObject({
      code: 'RULE_VIOLATION',
      details: { reason: 'assets_folder_missing' },
    })
    expect(fs.statSync(dir).isFile()).toBe(true)
  })
})
