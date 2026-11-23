import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import type { ComfyCheck } from '@/shared/schemas/commands/comfy-check'
import { NON_DRAFT_WORKFLOWS } from '@/main/providers/comfyui/workflows'
import { checked } from './store-fixture'

let f: Fixture
let stand: StandIn | undefined
afterEach(async () => {
  f.cleanup()
  await stand?.close()
  stand = undefined
})

describe('comfy.check compares the custom workflows [D-104, CW-3]', () => {
  it('compares every shipped non-draft workflow, then each custom one, asking for its nodes', async () => {
    f = makeFixture()
    stand = await startComfyStandIn()
    data(await f.user('comfy.setAddress', { address: stand.origin }))
    const store = f.core.deps.comfyWorkflows
    const id = store.add({ checked: checked('two-refs'), name: 'Two bottles', addedBy: 'user' })
      .stored.id
    const result = data<ComfyCheck>(await f.user('comfy.check', {}))
    expect(result.outcome).toBe('ok')
    expect(result.workflows.map((w) => w.id)).toEqual([...NON_DRAFT_WORKFLOWS.map((w) => w.id), id])
    const paths = stand.seen.map((q) => q.path)
    expect(paths).toContain('/object_info/MadeUpReferenceEdit')
  })
})
