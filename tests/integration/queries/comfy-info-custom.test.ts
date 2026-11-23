import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { checked } from '../comfy-workflows/store-fixture'
import { LEAVES } from '@/main/providers/comfyui/workflows/common'
import { WORKFLOW_IDS, type ComfyInfo } from '@/shared/schemas/queries/comfy'

let f: Fixture
afterEach(() => f.cleanup())

const info = async () => data<ComfyInfo>(await f.core.query('comfy.getInfo', {}, { actor: 'user' }))

describe('comfy.getInfo with custom workflows [D-104, CW-2]', () => {
  it('lists the custom workflows after the shipped ones, as status custom', async () => {
    f = makeFixture()
    const store = f.core.deps.comfyWorkflows
    const beach = store.add({ checked: checked('picture'), name: 'Beach', addedBy: 'agent' })
    const result = await info()
    expect(result.workflows.map((w) => w.id)).toEqual([...WORKFLOW_IDS, beach.stored.id])
    const custom = result.workflows.at(-1)
    expect(custom).toMatchObject({
      id: beach.stored.id,
      label: 'Beach',
      job: 'image',
      status: 'custom',
      offered: true,
      isDefault: false,
      licence: { name: 'Not known', url: '', commercialNote: null },
      custom: {
        addedBy: 'agent',
        addedAt: beach.stored.addedAt,
        nodeCount: 7,
        sizeMarks: true,
        references: 0,
      },
    })
    expect(JSON.stringify(result)).not.toContain('class_type')
  })

  it('says how many reference pictures a custom workflow takes [CW-4]', async () => {
    f = makeFixture()
    const store = f.core.deps.comfyWorkflows
    store.add({ checked: checked('two-refs'), name: 'Two', addedBy: 'user' })
    const custom = (await info()).workflows.at(-1)
    expect(custom?.custom?.references).toBe(2)
  })

  it('keeps offered for shipped entries, and marks the default ones', async () => {
    f = makeFixture()
    const before = (await info()).workflows.map((w) => [w.id, w.offered])
    f.core.deps.comfyWorkflows.add({ checked: checked('picture'), name: 'B', addedBy: 'user' })
    const after = await info()
    expect(after.workflows.slice(0, WORKFLOW_IDS.length).map((w) => [w.id, w.offered])).toEqual(
      before,
    )
    for (const w of after.workflows.slice(0, WORKFLOW_IDS.length)) {
      expect(w.isDefault).toBe(w.offered)
      expect(w.custom).toBeUndefined()
    }
  })

  it('gives the custom "left on the server" sentence only when a custom workflow exists', async () => {
    f = makeFixture()
    expect((await info()).leavesOnServer).not.toContain(LEAVES.custom)
    f.core.deps.comfyWorkflows.add({ checked: checked('two-refs'), name: 'R', addedBy: 'user' })
    const result = await info()
    expect(result.leavesOnServer).toContain(LEAVES.custom)
    expect(new Set(result.leavesOnServer).size).toBe(result.leavesOnServer.length)
  })
})
