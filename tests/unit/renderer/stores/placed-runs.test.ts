// spec/phases/round-2-editor.md D6, "An empty layer gets the first picture" (R2E-5): the
// window's picture runs started from the Generate panel. When one succeeds on a layer that was
// empty at the start and still is, its first kept picture goes on the layer with one
// layer.update through window.api, once; a refusal is dropped quietly.
import { describe, expect, it } from 'vitest'
import { placedRunsFor } from '@/renderer/stores/placed-runs'
import type { VariantGet } from '@/shared/schemas/queries/variant'
import type { JobRow } from '@/shared/schemas/rows/job'
import { variantGet, LOGO, P, V } from '../editor/editor-fixture'
import { makeFakeApi } from '../fake-api'
import { jobRow } from './job-fixture'

const RUN = { projectId: P, variantId: V, layerId: LOGO.id, wasEmpty: true }
const done = (id: string, assetIds = ['A5', 'A6'], over: Partial<JobRow> = {}) =>
  jobRow(id, {
    status: 'succeeded',
    layerId: LOGO.id,
    slot: null,
    result: { assetIds, failures: {} },
    ...over,
  })

function setup(reply: () => VariantGet | null = () => variantGet()) {
  const fake = makeFakeApi()
  fake.onQuery('variant.get', () => {
    const data = reply()
    return data
      ? { ok: true, data }
      : { ok: false, error: { code: 'NOT_FOUND', message: 'That variant is gone.' } }
  })
  const runs = placedRunsFor(fake.api)
  const updates = () => fake.commands.filter((c) => c.name === 'layer.update').map((c) => c.input)
  const outcome = (jobId: string) => runs.store.getState().outcomes[jobId]
  const settle = () => new Promise((r) => setTimeout(r, 0))
  return { fake, runs, updates, outcome, settle }
}

describe('placed runs [spec/phases/round-2-editor.md D6]', () => {
  it('puts the first kept picture on an empty layer once, with no crop', async () => {
    const { fake, runs, updates, outcome, settle } = setup()
    runs.register('J1', RUN)
    expect(outcome('J1')).toBe('placing')
    fake.emit('job.updated', jobRow('J1', { status: 'running', layerId: LOGO.id }))
    fake.emit('job.updated', done('J1'))
    fake.emit('job.updated', done('J1'))
    await settle()
    expect(updates()).toEqual([
      {
        projectId: P,
        layerId: LOGO.id,
        patch: { source: { assetId: 'A5' }, geometry: { crop: null } },
      },
    ])
    expect(fake.queries.find((q) => q.name === 'variant.get')?.input).toEqual({
      projectId: P,
      variantId: V,
    })
    expect(outcome('J1')).toBe('placed')
  })

  it('leaves a layer that got a picture meanwhile', async () => {
    const placed = { ...LOGO, source: { assetId: 'A1' } }
    const { fake, runs, updates, outcome, settle } = setup(() => variantGet({ layers: [placed] }))
    runs.register('J1', RUN)
    fake.emit('job.updated', done('J1'))
    await settle()
    expect(updates()).toEqual([])
    expect(outcome('J1')).toBe('left')
  })

  it.each([
    ['the layer is gone', () => variantGet({ layers: [] })],
    ['the variant is gone', () => null],
  ])('sends nothing when %s', async (_name, reply) => {
    const { fake, runs, updates, outcome, settle } = setup(reply)
    runs.register('J1', RUN)
    fake.emit('job.updated', done('J1'))
    await settle()
    expect(updates()).toEqual([])
    expect(outcome('J1')).toBe('left')
  })

  it.each([
    ['the layer had a picture at the start', { ...RUN, wasEmpty: false }, done('J1')],
    ['the run kept no picture', RUN, done('J1', [])],
    ['the run failed', RUN, done('J1', [], { status: 'failed', result: null })],
  ])('reads and sends nothing when %s', async (_name, run, row) => {
    const { fake, runs, updates, settle } = setup()
    runs.register('J1', run)
    fake.emit('job.updated', row)
    await settle()
    expect(updates()).toEqual([])
    expect(fake.queries.filter((q) => q.name === 'variant.get')).toEqual([])
  })

  it('drops a refused layer.update quietly', async () => {
    const { fake, runs, outcome, settle } = setup()
    fake.onCommand('layer.update', () => ({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That layer is gone.' },
    }))
    runs.register('J1', RUN)
    fake.emit('job.updated', done('J1'))
    await settle()
    expect(outcome('J1')).toBe('left')
  })

  it('uses a row that came before the reply that named the job', async () => {
    const { fake, runs, updates, outcome, settle } = setup()
    fake.emit('job.updated', done('J1'))
    fake.emit('job.updated', done('J2', ['A9']))
    runs.register('J1', RUN)
    await settle()
    expect(updates()).toHaveLength(1)
    expect(outcome('J1')).toBe('placed')
  })

  it('ignores other kinds of job', async () => {
    const { fake, runs, updates, settle } = setup()
    runs.register('J1', RUN)
    fake.emit('job.updated', done('J1', ['A5'], { kind: 'cutout' }))
    await settle()
    expect(updates()).toEqual([])
  })

  it('keeps one set of runs per window', () => {
    const fake = makeFakeApi()
    expect(placedRunsFor(fake.api)).toBe(placedRunsFor(fake.api))
    expect(placedRunsFor(makeFakeApi().api)).not.toBe(placedRunsFor(fake.api))
  })
})
