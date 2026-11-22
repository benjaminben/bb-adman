// AR-2 (security class, cost): the runner's untick check. Just before an agent-started job's
// first call, jc.call checks agentRunsOffered and the tick through the gate's one reader; off,
// the job ends cancelled, nothing is sent (spec/agent-runs.md "Unticking").
import { describe, it, expect, afterEach } from 'vitest'
import { gate, makeRunnerFixture, waitFor, type RunnerFixture } from './runner-fixture'
import { agentRunGate } from '@/main/commands/agent-run-gate'
import { geminiImage } from '@/main/providers/gemini/image'
import { fetchAnswering, testContext } from '../../unit/main/providers/gemini/recorded'

const fixtures: RunnerFixture[] = []
function fixture(): RunnerFixture {
  const f = makeRunnerFixture({ jobsAtOnce: 1 })
  fixtures.push(f)
  return f
}
afterEach(() => {
  while (fixtures.length) fixtures.pop()?.cleanup()
})

const ended = (x: RunnerFixture, id: string) => () =>
  ['succeeded', 'failed', 'cancelled'].includes(x.row(id)?.status ?? '')

const picture = { prompt: 'A red bicycle', references: [], width: 1080, height: 1080, count: 1 }

// Each job's body holds the provider's one place until `hold` opens (the user's job), then
// makes one call. A Gemini call goes through the real adapter to a recorded response.
function holding(x: RunnerFixture) {
  const hold = gate()
  const gemini = fetchAnswering('image-success.json')
  const sent: string[] = []
  x.f.body = async (jc, job) => {
    if (job.startedBy === 'user') await hold.promise
    return jc.call(async () => {
      sent.push(job.id)
      if (job.provider !== 'gemini') return { done: true }
      await geminiImage(testContext(), { fetch: gemini.fetchFn }).generate(picture)
      return { done: true }
    })
  }
  return { hold, sent, gemini }
}

describe("the runner's untick check, for a job waiting its turn [AR-2]", () => {
  it.each([
    // [case, provider, ticks while the job waits, the agent job's end]
    ['unticked while waiting (test 1)', 'fake', [false], 'cancelled'],
    ['unticked, then ticked again before its turn (test 4)', 'fake', [false, true], 'succeeded'],
    ['a hand-edited tick for a refused provider (test 5)', 'firefly', [], 'cancelled'],
    ['Gemini, unticked while waiting (test 7)', 'gemini', [false], 'cancelled'],
  ] as const)('%s', async (_name, provider, ticks, end) => {
    const x = fixture()
    x.tick(provider, true)
    const h = holding(x)
    const blocker = await x.start({ provider })
    await waitFor(() => x.row(blocker)?.status === 'running')
    const job = await x.start({ provider, startedBy: 'agent' })
    expect(x.row(job)?.status).toBe('queued')
    for (const allowed of ticks) x.tick(provider, allowed)
    expect(x.row(job)?.status).toBe('queued')
    h.hold.open()
    await waitFor(ended(x, job))
    expect(x.row(job)).toMatchObject({ status: end, paidCalls: 0 })
    expect(h.sent.includes(job)).toBe(end === 'succeeded')
    if (end === 'cancelled') expect(x.row(job)?.result).toBeNull()
    await waitFor(ended(x, blocker))
  })

  it('cancels with its signal fired and ProviderCancelled thrown, and the gate refuses next', async () => {
    const x = fixture()
    x.tick('fake', true)
    const seen: { aborted?: boolean; error?: string } = {}
    x.f.body = async (jc) => {
      x.tick('fake', false)
      try {
        return await jc.call(async () => 'sent')
      } catch (e) {
        seen.aborted = jc.signal.aborted
        seen.error = (e as Error).name
        throw e
      }
    }
    const job = await x.start({ startedBy: 'agent' })
    await waitFor(ended(x, job))
    expect(x.row(job)?.status).toBe('cancelled')
    expect(seen).toEqual({ aborted: true, error: 'ProviderCancelled' })
    const deps = { projects: x.projects, providers: x.providers, settings: x.settings }
    expect(() =>
      agentRunGate({ ...deps, passed: new Map() }, 'generation.runImages', { provider: 'fake' }),
    ).toThrow('The user has not allowed agents to start runs with Fake provider.')
  })

  it('sends nothing to Gemini for a cancelled job: the recorded answer is never asked for', async () => {
    const x = fixture()
    const h = holding(x)
    x.tick('gemini', true)
    const blocker = await x.start({ provider: 'gemini' })
    await waitFor(() => x.row(blocker)?.status === 'running')
    const job = await x.start({ provider: 'gemini', startedBy: 'agent' })
    x.tick('gemini', false)
    h.hold.open()
    await waitFor(ended(x, job))
    await waitFor(ended(x, blocker))
    expect(h.gemini.seen).toHaveLength(1)
    expect(x.row(blocker)?.paidCalls).toBe(1)
    expect(x.row(job)).toMatchObject({ status: 'cancelled', paidCalls: 0 })
  })
})

describe('the untick check skips a job already sent, and the user [AR-2]', () => {
  it('sends a ticked Gemini agent job to the recorded answer, counted as paid (test 6)', async () => {
    const x = fixture()
    const h = holding(x)
    x.tick('gemini', true)
    const job = await x.start({ provider: 'gemini', startedBy: 'agent' })
    await waitFor(ended(x, job))
    expect(x.row(job)).toMatchObject({ status: 'succeeded', paidCalls: 1 })
    expect(h.gemini.seen).toHaveLength(1)
  })

  it('lets an agent job whose first call is out make its second call (test 2)', async () => {
    const x = fixture()
    x.tick('fake', true)
    const between = gate()
    let calls = 0
    x.f.body = async (jc) => {
      await jc.call(async () => calls++)
      await between.promise
      await jc.call(async () => calls++)
      return { done: true }
    }
    const job = await x.start({ startedBy: 'agent', kind: 'video_generation' })
    await waitFor(() => calls === 1)
    x.tick('fake', false)
    between.open()
    await waitFor(ended(x, job))
    expect(x.row(job)?.status).toBe('succeeded')
    expect(calls).toBe(2)
  })

  it("runs a user's job to the end with the tick off (test 3)", async () => {
    const x = fixture()
    let calls = 0
    x.f.body = async (jc) => jc.call(async () => ++calls)
    const job = await x.start({ provider: 'fake' })
    await waitFor(ended(x, job))
    expect(x.row(job)?.status).toBe('succeeded')
    expect(calls).toBe(1)
  })
})
