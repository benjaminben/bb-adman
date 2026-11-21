import { describe, it, expect, afterEach } from 'vitest'
import { gate, makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import type { JobRunContext } from '../../../src/main/jobs/types'

const fixtures: RunnerFixture[] = []
function fixture(): RunnerFixture {
  const f = makeRunnerFixture({ cancelWaitMs: 60 })
  fixtures.push(f)
  return f
}
afterEach(() => {
  while (fixtures.length) fixtures.pop()?.cleanup()
})

const done = (x: RunnerFixture, id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(x.row(id)?.status ?? '')

describe('jc.setRemoteJobId [SPEC 6.11.1 1.38, 14 1.38 Y5]', () => {
  it('stores the ID in the row, and the last job.updated carries it', async () => {
    const x = fixture()
    const g = gate()
    x.f.body = async (jc) => {
      jc.setRemoteJobId('remote-7')
      await g.promise
      return { done: true }
    }
    const id = await x.start({ kind: 'video_generation' })
    await waitFor(() => x.row(id)?.remoteJobId === 'remote-7')
    expect(x.jobEvents(id).at(-1)?.remoteJobId).toBe('remote-7')
    g.open()
    await waitFor(done(x, id))
    expect(x.row(id)?.remoteJobId).toBe('remote-7')
  })

  it('writes nothing once the job has ended', async () => {
    const x = fixture()
    let held: JobRunContext | undefined
    x.f.body = async (jc) => {
      held = jc
      return { done: true }
    }
    const id = await x.start({ kind: 'video_generation' })
    await waitFor(done(x, id))
    const events = x.jobEvents(id).length
    held?.setRemoteJobId('too-late')
    expect(x.row(id)?.remoteJobId).toBeNull()
    expect(x.jobEvents(id)).toHaveLength(events)
  })
})
