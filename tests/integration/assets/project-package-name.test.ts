import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { projectPackage } from '../../../src/main/commands/project/package'
import { makeAssetBus, expectRefused } from './asset-bus'

// A name the open check would refuse, handed to the package step as if that check were
// bypassed: readMeta passes the stored row through with only the name replaced.
const bypass = vi.hoisted(() => ({ name: null as string | null }))
vi.mock('../../../src/main/db/meta', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../src/main/db/meta')>()
  return {
    ...real,
    readMeta: (db: Parameters<typeof real.readMeta>[0]) => {
      const meta = real.readMeta(db)
      return bypass.name === null ? meta : { ...meta, name: bypass.name }
    },
  }
})

let bus: ReturnType<typeof makeAssetBus>
let dir: string
let targetDir: string

beforeEach(() => {
  bus = makeAssetBus([projectPackage()])
  dir = path.dirname(bus.project.filePath)
  targetDir = path.join(dir, 'out', 'a', 'b')
  fs.mkdirSync(targetDir, { recursive: true })
})
afterEach(() => {
  bypass.name = null
  bus.cleanup()
})

// Every path under the test's folder, apart from the bus's own activity log.
const everything = () =>
  fs
    .readdirSync(dir, { recursive: true })
    .map(String)
    .filter((p) => p !== 'logs' && !p.startsWith(`logs${path.sep}`))
    .sort()
const pack = () => bus.user('project.package', { targetDir })
const refuse = () => expectRefused(bus, pack, 'INVALID_INPUT', 'not_a_project')

describe('project.package checks its folders again [SPEC 14 1.30 U2, 3.9]', () => {
  it('refuses a name row changed to ../../x after open, and makes nothing in or outside the target', async () => {
    bus.db.prepare("UPDATE project_meta SET value = '../../x' WHERE key = 'name'").run()
    const before = everything()
    await refuse()
    expect(everything()).toEqual(before)
  })

  for (const name of ['../../x', 'a/b', '..', '.', '']) {
    it(`refuses ${JSON.stringify(name)} even when the open check is bypassed`, async () => {
      bypass.name = name
      const before = everything()
      const error = await refuse()
      expect(error.message).toBe('This file is not an Adman project, or it is damaged.')
      expect(everything()).toEqual(before)
    })
  }

  it('still packages a good name', async () => {
    expect(await pack()).toMatchObject({
      ok: true,
      data: { packagePath: path.join(targetDir, 'P') },
    })
  })
})
