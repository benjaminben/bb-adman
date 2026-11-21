import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { projectPackage } from '../../../src/main/commands/project/package'
import { insertTestAsset } from './asset-rows'
import { makeAssetBus, expectRefused } from './asset-bus'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
const ID = '01JD0000000000000000000009'
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypisom'), Buffer.alloc(8)])

beforeEach(() => {
  bus = makeAssetBus([projectPackage()])
  dir = path.dirname(bus.project.filePath)
  fs.mkdirSync(path.join(dir, 'out'))
})
afterEach(() => bus.cleanup())

const put = (rel: string, bytes: Buffer | string) => {
  const p = path.join(dir, rel)
  fs.mkdirSync(path.dirname(p), { recursive: true })
  fs.writeFileSync(p, bytes)
  return p
}
const row = (absPath: string) =>
  insertTestAsset(bus.db, { id: ID, relPath: 'nowhere.png', absPath, kind: 'image' })
const pack = (skipMissing: boolean) =>
  bus.user('project.package', { targetDir: path.join(dir, 'out'), skipMissing })

// SPEC 14 [1.30] U4: rows a hostile project file could hold.
const cases: Array<[string, () => string]> = [
  [
    'a stored path with a dot in a folder name and none in the file name',
    () => {
      put('in/hostsfile', 'not a picture')
      fs.mkdirSync(path.join(dir, 'in', 'a', 'b', 'c', 'Fold.app'), { recursive: true })
      return [dir, 'in', 'a', 'b', 'c', 'Fold.app', '..', '..', '..', '..', 'hostsfile'].join(
        path.sep,
      )
    },
  ],
  ['a text file named secret.png', () => put('in/secret.png', 'a secret, in plain text')],
  ['a file with an extension of another kind', () => put('in/clip.mp4', MP4)],
]

describe('project.package copies only files that fit their kind [SPEC 14 1.30 U4, 3.9]', () => {
  for (const [label, make] of cases) {
    it(`skips ${label} when asked, and writes nothing outside {Name}`, async () => {
      row(make())
      expect(await pack(true)).toMatchObject({
        ok: true,
        data: { fileCount: 1, skippedAssetIds: [ID] },
      })
      expect(fs.readdirSync(path.join(dir, 'out'))).toEqual(['P'])
      expect(fs.readdirSync(path.join(dir, 'out', 'P', 'P Assets'))).toEqual([])
      expect(fs.existsSync(path.join(dir, 'hostsfile'))).toBe(false)
    })

    it(`refuses ${label} with MISSING_FILE when skipMissing is off`, async () => {
      row(make())
      const error = await expectRefused(bus, () => pack(false), 'MISSING_FILE')
      expect(error.details).toEqual({ assetIds: [ID] })
      expect(fs.readdirSync(path.join(dir, 'out'))).toEqual([])
    })
  }
})
