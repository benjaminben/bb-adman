import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { projectSetAssetsDir } from '../../../src/main/commands/project/set-assets-dir'
import type { JobService } from '../../../src/main/jobs/types'
import { makeAssetBus } from './asset-bus'
import { insertTestAsset } from './asset-rows'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
const BAD = '../x'

const jobs: JobService = {
  enqueue: () => 'job',
  cancel: async () => {},
  cancelAll: async () => {},
  activeCount: () => 0,
  projectOpened: async () => {},
}

beforeEach(() => {
  bus = makeAssetBus([projectSetAssetsDir({ jobs })])
  dir = path.dirname(bus.project.filePath)
})
afterEach(() => bus.cleanup())

const rowOf = (id: string) => bus.db.prepare('SELECT * FROM asset WHERE id = ?').get(id)

describe('project.setAssetsDir and a bad managed row [SPEC 14 1.32 U10]', () => {
  it('succeeds and leaves a managed row whose id is not plain as it was', async () => {
    const rel = path.join('P Assets', 'x.png')
    insertTestAsset(bus.db, {
      id: BAD,
      storage: 'managed',
      relPath: rel,
      absPath: path.join(dir, rel),
    })
    const before = rowOf(BAD)
    const art = path.join(dir, 'Art')
    fs.mkdirSync(art)
    expect(await bus.user('project.setAssetsDir', { dir: art })).toEqual({
      ok: true,
      data: { assetsDir: art, repointedAssetIds: [] },
    })
    expect(rowOf(BAD)).toEqual(before)
  })
})
