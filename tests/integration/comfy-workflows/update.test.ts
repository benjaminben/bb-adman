import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'
import { checked } from './store-fixture'
import { sizeFromChoice } from '@/shared/comfy/custom-workflow'
import type { CustomFixture } from '../../fixtures/comfy-custom/load'

let f: Fixture
afterEach(() => f.cleanup())

const add = (fixture: CustomFixture, name = 'Beach') =>
  f.core.deps.comfyWorkflows.add({ checked: checked(fixture), name, addedBy: 'user' }).stored.id
const update = (input: unknown) => f.user('comfyWorkflow.update', input)
const stored = (id: string) => f.core.deps.comfyWorkflows.get(id)?.stored

const VIDEO = { fps: 30, maxMs: 10_000, frameStep: 1, frameOffset: 0 }

describe('comfyWorkflow.update [D-104, CW-2]', () => {
  it('changes the name and replies with the ID', async () => {
    f = makeFixture()
    const id = add('picture')
    expect(data(await update({ workflowId: id, name: 'Harbour at night' }))).toEqual({
      workflowId: id,
    })
    expect(stored(id)?.name).toBe('Harbour at night')
  })

  it('changes the size from the options, for a graph with size marks', async () => {
    f = makeFixture()
    const id = add('picture')
    data(await update({ workflowId: id, size: { multiple: 64, maxMegapixels: 0.4 } }))
    expect(stored(id)?.size).toEqual(sizeFromChoice(64, 0.4))
  })

  it('changes the video values of a video graph', async () => {
    f = makeFixture()
    const id = add('video-prompt')
    data(await update({ workflowId: id, video: VIDEO }))
    expect(stored(id)?.video).toEqual(VIDEO)
  })

  it('refuses a size for a graph with no size marks', async () => {
    f = makeFixture()
    const id = add('two-refs')
    const result = await update({ workflowId: id, size: { multiple: 16, maxMegapixels: 1 } })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(stored(id)?.size).toBeNull()
  })

  it('refuses video values for a graph that makes no video', async () => {
    f = makeFixture()
    const id = add('picture')
    const result = await update({ workflowId: id, video: VIDEO })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(stored(id)?.video).toBeNull()
  })

  it.each([
    ['a size multiple not offered', { size: { multiple: 12, maxMegapixels: 1 } }],
    ['a size not offered', { size: { multiple: 16, maxMegapixels: 3 } }],
    ['an empty name', { name: '' }],
    ['a graph', { graph: {} }],
  ])('refuses %s with INVALID_INPUT', async (_label, change) => {
    f = makeFixture()
    const id = add('picture')
    const result = await update({ workflowId: id, ...change })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
  })

  it('refuses a name another workflow has', async () => {
    f = makeFixture()
    const id = add('picture')
    add('two-refs', 'Harbour')
    const result = await update({ workflowId: id, name: 'HARBOUR' })
    expect(result).toMatchObject({ ok: false, error: { details: { reason: 'workflow_name_taken' } } })
    expect(data(await update({ workflowId: id, name: 'BEACH' }))).toEqual({ workflowId: id })
  })

  it('refuses a shipped ID with INVALID_INPUT and an unknown one with NOT_FOUND', async () => {
    f = makeFixture()
    expect(await update({ workflowId: 'moss-text-to-image', name: 'X' })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(await update({ workflowId: 'custom-0123456789ab', name: 'X' })).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That workflow is not on this computer.' },
    })
  })

describe('comfyWorkflow.update: the name [D-104, CW-2]', () => {
  it('cleans the name with the shared name cleaner', async () => {
    f = makeFixture()
    const id = add('picture')
    const name = `"Harbour"${String.fromCharCode(0x202e)}  at night\u0007`
    data(await update({ workflowId: id, name }))
    expect(stored(id)?.name).toBe("'Harbour' at night")
  })

  it('refuses a name that cleans to nothing with INVALID_INPUT', async () => {
    f = makeFixture()
    const id = add('picture')
    const result = await update({ workflowId: id, name: `\u0000${String.fromCharCode(0x202e)}` })
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(stored(id)?.name).toBe('Beach')
  })

  it('takes "Harbour " as the name another workflow has as "harbour"', async () => {
    f = makeFixture()
    const id = add('picture')
    add('two-refs', 'harbour')
    const result = await update({ workflowId: id, name: 'Harbour ' })
    expect(result).toMatchObject({ ok: false, error: { details: { reason: 'workflow_name_taken' } } })
  })
})
})
