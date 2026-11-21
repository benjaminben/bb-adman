// spec/screens-ai.md, "Attached jobs and the close warning" [D-036, OI-31]: the attached jobs
// this window started, by owner. It follows job.updated; when a job ends it runs `finish` if
// the job succeeded, and forgets it.
import { describe, expect, it, vi } from 'vitest'
import {
  attachedStoreFor,
  createAttachedStore,
  dialogJobs,
  variantJobs,
} from '@/renderer/stores/attached-store'
import { makeFakeApi } from '../fake-api'
import { jobRow } from './job-fixture'

const TAB = { projectId: 'P1', variantId: 'V1' }
const OTHER_TAB = { projectId: 'P1', variantId: 'V2' }
const DIALOG = { projectId: 'P1', dialog: 'copy-options' }
const layout = (id: string, status: 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled') =>
  jobRow(id, { kind: 'layout_proposal', status })

function setup() {
  const fake = makeFakeApi()
  const store = createAttachedStore(fake.api)
  const stop = store.getState().subscribe()
  return { fake, store, stop, s: () => store.getState() }
}

const ids = (jobs: { jobId: string }[]) => jobs.map((j) => j.jobId)

describe('attached store [spec/screens-ai.md, D-036]', () => {
  it('registers a job under its owner and lists it per owner', () => {
    const { s } = setup()
    s().register('J1', TAB)
    s().register('J2', OTHER_TAB)
    s().register('J3', DIALOG)
    expect(ids(variantJobs(s(), 'P1', ['V1']))).toEqual(['J1'])
    expect(ids(variantJobs(s(), 'P1', ['V1', 'V2']))).toEqual(['J1', 'J2'])
    expect(ids(variantJobs(s(), 'P2', ['V1']))).toEqual([])
    expect(ids(dialogJobs(s(), 'copy-options'))).toEqual(['J3'])
    expect(ids(dialogJobs(s(), 'brief-reading'))).toEqual([])
  })

  it('takes the kind and provider from job.updated', () => {
    const { fake, s } = setup()
    s().register('J1', TAB)
    fake.emit('job.updated', layout('J1', 'running'))
    expect(s().jobs).toEqual([
      { jobId: 'J1', owner: TAB, kind: 'layout_proposal', provider: 'gemini' },
    ])
  })

  it('end forgets a job without finishing it', () => {
    const { fake, s } = setup()
    const finish = vi.fn()
    s().register('J1', TAB, finish)
    s().end('J1')
    fake.emit('job.updated', layout('J1', 'succeeded'))
    expect(s().jobs).toEqual([])
    expect(finish).not.toHaveBeenCalled()
  })

  it('runs finish once when the job succeeds, then forgets it', () => {
    const { fake, s } = setup()
    const finish = vi.fn()
    s().register('J1', TAB, finish)
    fake.emit('job.updated', layout('J1', 'running'))
    fake.emit('job.updated', layout('J1', 'succeeded'))
    fake.emit('job.updated', layout('J1', 'succeeded'))
    expect(finish).toHaveBeenCalledTimes(1)
    expect(s().jobs).toEqual([])
  })

  it.each(['failed', 'cancelled'] as const)('never finishes a %s job, and forgets it', (end) => {
    const { fake, s } = setup()
    const finish = vi.fn()
    s().register('J1', TAB, finish)
    fake.emit('job.updated', layout('J1', end))
    expect(finish).not.toHaveBeenCalled()
    expect(s().jobs).toEqual([])
  })

  it('ignores rows of jobs it does not hold', () => {
    const { fake, s } = setup()
    fake.emit('job.updated', jobRow('J9', { status: 'running' }))
    expect(s().jobs).toEqual([])
  })

  it('uses a row that came before the register: a job that already succeeded finishes at once', () => {
    const { fake, s } = setup()
    const finish = vi.fn()
    fake.emit('job.updated', layout('J1', 'queued'))
    fake.emit('job.updated', layout('J1', 'succeeded'))
    s().register('J1', TAB, finish)
    expect(finish).toHaveBeenCalledTimes(1)
    expect(s().jobs).toEqual([])
  })

  it('uses a row that came before the register for the kind of a job still going', () => {
    const { fake, s } = setup()
    fake.emit('job.updated', jobRow('J1', { kind: 'copy_options', provider: 'fake' }))
    s().register('J1', DIALOG)
    expect(s().jobs).toEqual([
      { jobId: 'J1', owner: DIALOG, kind: 'copy_options', provider: 'fake' },
    ])
  })

  it('stops following job.updated when unsubscribed', () => {
    const { fake, s, stop } = setup()
    s().register('J1', TAB)
    stop()
    fake.emit('job.updated', layout('J1', 'succeeded'))
    expect(ids(s().jobs)).toEqual(['J1'])
  })

  it('keeps one store per window, already following job.updated', () => {
    const fake = makeFakeApi()
    const store = attachedStoreFor(fake.api)
    expect(attachedStoreFor(fake.api)).toBe(store)
    expect(attachedStoreFor(makeFakeApi().api)).not.toBe(store)
    store.getState().register('J1', TAB)
    fake.emit('job.updated', layout('J1', 'cancelled'))
    expect(store.getState().jobs).toEqual([])
  })
})
