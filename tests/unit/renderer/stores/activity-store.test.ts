// P4-14 (spec/screens-ai.md, "The activity panel", Store): job.activity for the shown project,
// rows kept by ID, job.updated applied to a held row, a new ID read again, a late reply dropped.
import { describe, expect, it } from 'vitest'
import { createActivityStore } from '@/renderer/stores/activity-store'
import type { JobActivity } from '@/shared/schemas/queries/activity'
import { makeFakeApi } from '../fake-api'
import { jobRow } from './job-fixture'

const PLACE = { campaignName: 'Spring', variantLabel: 'Hero · 1:1 · en', layerName: 'Can' }

function entry(id: string, over: Parameters<typeof jobRow>[1] = {}) {
  return { job: jobRow(id, over), place: PLACE }
}

function setup(...answers: JobActivity[]) {
  const fake = makeFakeApi()
  let i = 0
  fake.onQuery('job.activity', () => ({
    ok: true,
    data: answers[Math.min(i++, answers.length - 1)],
  }))
  const store = createActivityStore({ api: fake.api })
  return { fake, store }
}

const reads = (fake: ReturnType<typeof makeFakeApi>) =>
  fake.queries.filter((q) => q.name === 'job.activity')

describe('activity store [P4-14, FR-152, FR-217]', () => {
  it('loads job.activity for the shown project', async () => {
    const { fake, store } = setup([entry('J1'), entry('J2')])
    await store.getState().load('P1')
    expect(reads(fake)[0]?.input).toEqual({ projectId: 'P1' })
    expect(store.getState().rows.map((r) => r.job.id)).toEqual(['J1', 'J2'])
    expect(store.getState().projectId).toBe('P1')
  })

  it('clears the rows and reads nothing with no shown project', async () => {
    const { fake, store } = setup([entry('J1')])
    await store.getState().load('P1')
    await store.getState().load(null)
    expect(store.getState().rows).toEqual([])
    expect(reads(fake)).toHaveLength(1)
  })

  it('applies a job.updated to a held row and keeps its place', async () => {
    const { fake, store } = setup([entry('J1')])
    const stop = store.getState().subscribe()
    await store.getState().load('P1')
    fake.emit('job.updated', jobRow('J1', { status: 'running', updatedAt: '2026-11-21T00:01:00Z' }))
    expect(store.getState().rows[0]?.job.status).toBe('running')
    expect(store.getState().rows[0]?.place).toEqual(PLACE)
    expect(reads(fake)).toHaveLength(1)
    stop()
  })

  it('reads the query again for a row it does not hold', async () => {
    const { fake, store } = setup([entry('J1')], [entry('J2'), entry('J1')])
    const stop = store.getState().subscribe()
    await store.getState().load('P1')
    fake.emit('job.updated', jobRow('J2'))
    await expect.poll(() => store.getState().rows.length).toBe(2)
    expect(reads(fake)).toHaveLength(2)
    stop()
  })

  it('drops a reply older than the last one asked for', async () => {
    const fake = makeFakeApi()
    const pending: Array<(data: JobActivity) => void> = []
    fake.onQuery(
      'job.activity',
      () => new Promise((resolve) => pending.push((data) => resolve({ ok: true, data }))),
    )
    const store = createActivityStore({ api: fake.api })
    const first = store.getState().load('P1')
    const second = store.getState().load('P2')
    pending[1]?.([entry('NEW')])
    await second
    pending[0]?.([entry('OLD')])
    await first
    expect(store.getState().rows.map((r) => r.job.id)).toEqual(['NEW'])
    expect(store.getState().projectId).toBe('P2')
  })

  it('keeps its own later row over an older one in a reply', async () => {
    const later = '2026-11-21T00:05:00.000Z'
    const { fake, store } = setup([entry('J1')], [entry('J2'), entry('J1', { status: 'running' })])
    const stop = store.getState().subscribe()
    await store.getState().load('P1')
    fake.emit('job.updated', jobRow('J1', { status: 'succeeded', updatedAt: later }))
    fake.emit('job.updated', jobRow('J2'))
    await expect.poll(() => store.getState().rows.length).toBe(2)
    expect(store.getState().rows.find((r) => r.job.id === 'J1')?.job.status).toBe('succeeded')
    stop()
  })

  it('opens and closes the panel', () => {
    const { store } = setup([])
    expect(store.getState().open).toBe(false)
    store.getState().setOpen(true)
    expect(store.getState().open).toBe(true)
    store.getState().setOpen(false)
    expect(store.getState().open).toBe(false)
  })
})
