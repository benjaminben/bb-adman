import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { projectSetAssetsDir } from '../../../src/main/commands/project/set-assets-dir'
import type { JobService } from '../../../src/main/jobs/types'
import { makeAssetBus } from './asset-bus'
import { insertTestAsset } from './asset-rows'

let bus: ReturnType<typeof makeAssetBus>
let dir: string
const A = '01JD0000000000000000000001'
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13])

const noJobs: JobService = {
  enqueue: () => 'job',
  cancel: async () => {},
  cancelAll: async () => {},
  activeCount: () => 0,
  projectOpened: async () => {},
}

beforeEach(() => {
  bus = makeAssetBus([projectSetAssetsDir({ jobs: noJobs })])
  dir = path.dirname(bus.project.filePath)
})
afterEach(() => {
  vi.restoreAllMocks()
  bus.cleanup()
})

// Where each opened or read path really leads, so a followed link shows as its target.
function watchOpened(): string[] {
  const seen: string[] = []
  const open = fs.promises.open
  vi.spyOn(fs.promises, 'open').mockImplementation(((p: string, ...rest: []) => {
    seen.push(fs.realpathSync(p))
    return open.call(fs.promises, p, ...rest)
  }) as never)
  const stream = fs.createReadStream
  vi.spyOn(fs, 'createReadStream').mockImplementation(((p: string, ...rest: []) => {
    seen.push(fs.realpathSync(p))
    return stream.call(fs, p, ...rest)
  }) as never)
  return seen
}

// Where the platform cannot make a link, there is nothing to test.
const canLink = process.platform !== 'win32'

describe('project.setAssetsDir and links [SPEC 14, 1.29 T2]', () => {
  it.runIf(canLink)(
    'does not pick up a link named like a managed file, and never opens its target',
    async () => {
      const rel = path.join('P Assets', `${A}.png`)
      insertTestAsset(bus.db, {
        id: A,
        storage: 'managed',
        relPath: rel,
        absPath: path.join(dir, rel),
      })
      const target = path.join(dir, 'outside', 'secret.png')
      fs.mkdirSync(path.dirname(target), { recursive: true })
      fs.writeFileSync(target, PNG)
      const moved = path.join(dir, 'Moved')
      fs.mkdirSync(moved)
      fs.symlinkSync(target, path.join(moved, `${A}.png`))
      const seen = watchOpened()
      const result = await bus.user('project.setAssetsDir', { dir: moved })
      expect(result).toMatchObject({ ok: true, data: { repointedAssetIds: [] } })
      expect(bus.db.prepare('SELECT abs_path, rel_path FROM asset').get()).toEqual({
        abs_path: path.join(dir, rel),
        rel_path: rel,
      })
      expect(seen).not.toContain(fs.realpathSync(target))
    },
  )
})
