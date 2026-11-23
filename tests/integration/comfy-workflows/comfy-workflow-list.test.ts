import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { checked } from './store-fixture'
import type { CustomFixture } from '../../fixtures/comfy-custom/load'
import type { ComfyWorkflowList } from '@/shared/schemas/queries/comfy-workflow'
import type { Actor } from '@/shared/schemas/events'

let f: Fixture
afterEach(() => f.cleanup())

const add = (fixture: CustomFixture, name: string) =>
  f.core.deps.comfyWorkflows.add({ checked: checked(fixture), name, addedBy: 'user' }).stored.id
const list = async (actor: Actor = 'user') =>
  data<ComfyWorkflowList>(await f.core.query('comfyWorkflow.list', {}, { actor })).workflows

describe('comfyWorkflow.list [D-104, CW-2]', () => {
  it('gives the five fields only, for both actors', async () => {
    f = makeFixture()
    add('picture', 'Beach')
    for (const actor of ['user', 'agent'] as const) {
      const workflows = await list(actor)
      expect(workflows.length).toBeGreaterThan(0)
      for (const w of workflows) {
        expect(Object.keys(w).sort()).toEqual(['id', 'isDefault', 'job', 'name', 'start'])
      }
    }
  })

  it('lists the shipped proven workflows that make pictures and video, then the custom ones', async () => {
    f = makeFixture()
    const beach = add('picture', 'Beach')
    const clip = add('video-first-frame', 'Clip')
    expect(await list()).toEqual([
      {
        id: 'moss-text-to-image',
        name: 'MOSS-Image: picture from a prompt',
        job: 'image',
        start: null,
        isDefault: true,
      },
      expect.objectContaining({ id: 'h3-text-to-video', start: 'prompt', isDefault: true }),
      expect.objectContaining({ id: 'h3-image-to-video', start: 'first_frame', isDefault: true }),
      expect.objectContaining({
        id: 'h3-reference-to-video',
        start: 'references',
        isDefault: true,
      }),
      expect.objectContaining({ id: 'flux3-klein-edit-references', job: 'image_refs' }),
      { id: beach, name: 'Beach', job: 'image', start: null, isDefault: false },
      { id: clip, name: 'Clip', job: 'video', start: 'first_frame', isDefault: false },
    ])
  })

  it('never lists a draft, a cut-out or an extend workflow', async () => {
    f = makeFixture()
    const ids = (await list()).map((w) => w.id)
    for (const id of ['moss-edit-references', 'moss-extend', 'birefnet-cutout']) {
      expect(ids).not.toContain(id)
    }
  })

  it('holds no graph, node, input, title or path', async () => {
    f = makeFixture()
    add('two-refs', 'Refs')
    const text = JSON.stringify(await list('agent'))
    for (const word of ['class_type', 'inputs', 'adman:', 'noise_seed', f.root]) {
      expect(text).not.toContain(word)
    }
  })

  it('refuses an input with keys', async () => {
    f = makeFixture()
    const result = await f.core.query('comfyWorkflow.list', { all: true }, { actor: 'agent' })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
  })
})
