import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'

let f: Fixture
afterEach(() => f.cleanup())

// A PNG header for a 300 by 200 picture: signature, IHDR length, IHDR, width, height.
const PNG = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13, 0x49, 0x48, 0x44, 0x52, 0, 0, 1,
  0x2c, 0, 0, 0, 0xc8, 8, 6, 0, 0, 0,
])

async function openProject(): Promise<string> {
  return data<{ projectId: string }>(
    await f.user('project.create', { name: 'P', location: f.projectsDir }),
  ).projectId
}

describe('the app core runs the asset domain [SPEC 14, Slice A part 2, A2-1]', () => {
  it('imports a file and lists it through the app bus and queries', async () => {
    f = makeFixture()
    const projectId = await openProject()
    const file = path.join(f.root, 'hero.png')
    fs.writeFileSync(file, PNG)
    const input = { projectId, paths: [file], library: 'asset', copy: false }
    const { assetIds } = data<{ assetIds: string[] }>(await f.user('asset.import', input))
    const list = data<Array<{ id: string }>>(
      await f.core.query('asset.list', { projectId }, { actor: 'user' }),
    )
    expect(list.map((r) => r.id)).toEqual(assetIds)
  })
})
