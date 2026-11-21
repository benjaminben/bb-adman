// SPEC 14 1.41 TP-2 "The job store": job.list on load, job.updated, and the one reader of
// a picture job's asset IDs.
import { describe, expect, it, vi } from 'vitest'
import {
  createJobStore,
  requestCount,
  resultAssetIds,
} from '../../../../src/renderer/stores/job-store'
import { makeFakeApi } from '../fake-api'
import { jobRow } from './job-fixture'

function setup(rows = [jobRow('J1')]) {
  const fake = makeFakeApi()
  fake.onQuery('job.list', () => ({ ok: true, data: rows }))
  const command = vi.fn(async () => ({ ok: true as const, data: null }))
  const store = createJobStore({ api: fake.api, command }, 'P1')
  return { fake, store, command }
}

const listCalls = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'job.list')

describe('job store [SPEC 14 1.41 TP-2]', () => {
  it('reads job.list for the project and the variant', async () => {
    const { fake, store } = setup()
    await store.getState().load('V1')
    expect(listCalls(fake).map((q) => q.input)).toEqual([{ projectId: 'P1', variantId: 'V1' }])
    expect(store.getState().rows.map((r) => r.id)).toEqual(['J1'])
  })

  it('replaces a row whose ID it holds when job.updated arrives', async () => {
    const { fake, store } = setup()
    const stop = store.getState().subscribe()
    await store.getState().load('V1')
    fake.emit('job.updated', jobRow('J1', { status: 'running' }))
    expect(store.getState().rows[0]?.status).toBe('running')
    expect(listCalls(fake)).toHaveLength(1)
    stop()
  })

  it('reads job.list again for a row whose ID it does not hold', async () => {
    const { fake, store } = setup()
    store.getState().subscribe()
    await store.getState().load('V1')
    fake.emit('job.updated', jobRow('J9', { variantId: 'V2' }))
    await vi.waitFor(() => expect(listCalls(fake)).toHaveLength(2))
    expect(store.getState().rows.map((r) => r.id)).toEqual(['J1'])
  })

  it('takes a row whose ID a command just returned, newest first', async () => {
    const { fake, store } = setup()
    store.getState().subscribe()
    await store.getState().load('V1')
    store.getState().track('J2')
    fake.emit('job.updated', jobRow('J2', { createdAt: '2026-11-21T01:00:00.000Z' }))
    expect(store.getState().rows.map((r) => r.id)).toEqual(['J2', 'J1'])
    expect(listCalls(fake)).toHaveLength(1)
  })

  it('does not draw a returned run of another variant under the chosen one', async () => {
    const { fake, store } = setup()
    store.getState().subscribe()
    await store.getState().load('V1')
    store.getState().track('J2')
    fake.emit('job.updated', jobRow('J2', { variantId: 'V2' }))
    expect(store.getState().rows.map((r) => r.id)).toEqual(['J1'])
  })

  it('drops the rows of the last variant when another is loaded', async () => {
    const { fake, store } = setup()
    await store.getState().load('V1')
    fake.onQuery('job.list', () => ({ ok: true, data: [] }))
    await store.getState().load('V2')
    expect(store.getState().rows).toEqual([])
  })

  it('stops listening after the returned stop is called', async () => {
    const { fake, store } = setup()
    store.getState().subscribe()()
    await store.getState().load('V1')
    fake.emit('job.updated', jobRow('J1', { status: 'running' }))
    expect(store.getState().rows[0]?.status).toBe('queued')
  })

  it('sends job.markSeen once for a job', async () => {
    const { store, command } = setup()
    await store.getState().markSeen('J1')
    await store.getState().markSeen('J1')
    expect(command.mock.calls).toEqual([['job.markSeen', { projectId: 'P1', jobIds: ['J1'] }]])
  })
})

describe('resultAssetIds [SPEC 14 1.42 H-R1]', () => {
  it('gives the asset IDs of a picture job result', () => {
    const row = jobRow('J1', { result: { assetIds: ['A1', 'A2'], failures: {} } })
    expect(resultAssetIds(row)).toEqual(['A1', 'A2'])
  })

  it('gives no pictures when the result does not fit', () => {
    expect(resultAssetIds(jobRow('J1', { result: { assetIds: 'A1' } }))).toEqual([])
    expect(resultAssetIds(jobRow('J1', { result: null }))).toEqual([])
  })
})

describe('requestCount', () => {
  it('gives the count of a picture job request, or null when it does not fit', () => {
    expect(requestCount(jobRow('J1'))).toBe(2)
    expect(requestCount(jobRow('J1', { request: { count: 'x' } }))).toBeNull()
  })
})
