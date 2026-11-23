import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeComfyFixture, type ComfyFixture } from '../generation/comfy-fixture'
import { data } from '../core-fixture'
import { checked } from './store-fixture'
import type { CustomFixture } from '../../fixtures/comfy-custom/load'
import type { ComfyWorkflowList } from '@/shared/schemas/queries/comfy-workflow'
import type { Actor } from '@/shared/schemas/events'

// [D-103] The shipped workflows are proven; this file proves the trial rule on a copy where
// each of them is a trial (tests/helpers/trial-workflows.ts).
vi.mock('@/main/providers/comfyui/workflows', async (load) =>
  (await import('../../helpers/trial-workflows')).asTrial(await load()),
)

let f: ComfyFixture
afterEach(() => f.cleanup())

const add = (fixture: CustomFixture, name: string) =>
  f.core.deps.comfyWorkflows.add({ checked: checked(fixture), name, addedBy: 'user' }).stored.id
const list = async (actor: Actor) =>
  data<ComfyWorkflowList>(await f.core.query('comfyWorkflow.list', {}, { actor })).workflows

describe('comfyWorkflow.list and trial workflows [D-104, D-080]', () => {
  it('lists no trial workflow with the dev tools off, for either actor', async () => {
    f = await makeComfyFixture({ devTools: false })
    add('picture', 'Beach')
    for (const actor of ['user', 'agent'] as const) {
      expect((await list(actor)).map((w) => w.name)).toEqual(['Beach'])
    }
  })

  it('makes the oldest custom one that fits the default when no shipped one fits', async () => {
    f = await makeComfyFixture({ devTools: false })
    const older = add('picture', 'Older')
    const newer = add('picture', 'Newer')
    const refs = add('two-refs', 'Refs')
    const video = add('video-refs', 'Clip')
    const defaults = (await list('user')).filter((w) => w.isDefault).map((w) => w.id)
    expect(defaults).toEqual([older, refs, video])
    expect(defaults).not.toContain(newer)
  })

  it('lists the trial workflows with the dev tools on, and they are the defaults', async () => {
    f = await makeComfyFixture({ devTools: true })
    const beach = add('picture', 'Beach')
    const workflows = await list('agent')
    expect(workflows.map((w) => w.id)).toContain('moss-text-to-image')
    expect(workflows.find((w) => w.id === 'moss-text-to-image')?.isDefault).toBe(true)
    expect(workflows.find((w) => w.id === beach)?.isDefault).toBe(false)
    expect(workflows.map((w) => w.id)).not.toContain('moss-edit-references')
  })
})
