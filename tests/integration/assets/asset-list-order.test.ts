import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { assetImport } from '../../../src/main/commands/asset/import'
import { assetList } from '../../../src/main/queries/asset'
import { makeAssetBus } from './asset-bus'
import { insertTestAsset } from './asset-rows'

let bus: ReturnType<typeof makeAssetBus>
const user = { actor: 'user' as const }

// A PNG header for a 300 by 200 picture: signature, IHDR length, IHDR, width, height.
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1,
  0x2c, 0, 0, 0, 0xc8, 8, 6, 0, 0, 0,
])

beforeEach(() => {
  bus = makeAssetBus([assetImport({ now: () => new Date('2026-11-20T10:00:00.000Z') })])
})
afterEach(() => bus.cleanup())

const listIds = async () => {
  const rows = (await assetList(bus)({ projectId: bus.projectId }, user)) as Array<{ id: string }>
  return rows.map((r) => r.id)
}

describe('asset.list order [SPEC 14, Slice A rulings point 7, A2-6]', () => {
  it('gives three imported files back by id, ascending', async () => {
    const dir = path.dirname(bus.project.filePath)
    const paths = [3, 1, 2].map((n) => {
      const p = path.join(dir, `pic${n}.png`)
      fs.writeFileSync(p, Buffer.concat([PNG, Buffer.from([n])]))
      return p
    })
    const result = (await bus.user('asset.import', { paths, library: 'asset', copy: false })) as {
      data: { assetIds: string[] }
    }
    expect(await listIds()).toEqual([...result.data.assetIds].sort())
  })

  it('gives rows by id even when they were added in another order', async () => {
    const ids = [
      '01JD0000000000000000000003',
      '01JD0000000000000000000001',
      '01JD0000000000000000000002',
    ]
    for (const id of ids) insertTestAsset(bus.db, { id, relPath: `${id}.png`, absPath: '/n.png' })
    expect(await listIds()).toEqual([...ids].sort())
  })
})
