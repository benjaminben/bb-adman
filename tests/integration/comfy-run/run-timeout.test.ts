import { describe, it, expect, afterEach } from 'vitest'
import { randomUUID } from 'node:crypto'
import { startComfyStandIn, type StandIn } from '../../helpers/comfy-stand-in'
import { createComfyClient } from '@/main/providers/comfyui/client'
import { fillWorkflow } from '@/main/providers/comfyui/fill'
import { flux3KleinEditReferences } from '@/main/providers/comfyui/workflows/flux3'
import { foreignCancels, recordCalls } from '../../comfy/recorder'
import { runGraph } from '../../comfy/run-graph'
import { makePrinter } from '../../comfy/print'
import { MIN_TARGETED_INTERRUPT, versionAtLeast } from '../../comfy/version'

let stand: StandIn | undefined
afterEach(async () => {
  await stand?.close()
  stand = undefined
})

const spec = flux3KleinEditReferences
const graph = fillWorkflow(spec, { prompt: 'shapes', references: ['adman/adman-0.png'] })
const MAY_STILL_RUN =
  'The run may still be running on the server: it was taken off the queue but not interrupted.'

function fakeTiming(limitMs: number) {
  const clock = { at: 0 }
  return {
    pollMs: 2_000,
    limitMs,
    now: () => clock.at,
    sleep: async (ms: number) => {
      clock.at += ms
      await Promise.resolve()
    },
  }
}

// A run that never ends; `job` is what /api/jobs answers on every poll.
async function timedOut(version: string, job: 'pending' | 'in_progress' | 'none') {
  stand = await startComfyStandIn()
  const s = stand
  const id = randomUUID()
  if (job === 'none') {
    s.reply(`GET /api/jobs/${id}`, { status: 404, json: {} })
    s.reply('GET /queue', { json: { queue_running: [[1, id]], queue_pending: [] } })
  } else {
    s.reply(`GET /api/jobs/${id}`, { json: { status: job } })
  }
  const printed: string[] = []
  const print = makePrinter(s.origin, (line) => printed.push(line))
  const recorded = recordCalls(createComfyClient({ origin: s.origin, ownPorts: () => [] }))
  const run = runGraph(recorded.client, spec, graph, id, print, fakeTiming(10_000), 1_000, version)
  const error = await run.then(
    () => new Error('The run did not fail'),
    (e: unknown) => e as Error,
  )
  const posts = s.seen.filter((r) => r.method === 'POST').map((r) => r.path)
  return { id, error, posts, printed, recorded }
}

describe('versionAtLeast and MIN_TARGETED_INTERRUPT [SPEC 6.10.14]', () => {
  it('is 0.30.0, compared as dotted numbers; an unreadable version is never enough', () => {
    expect(MIN_TARGETED_INTERRUPT).toBe('0.30.0')
    expect(versionAtLeast('0.30.0', MIN_TARGETED_INTERRUPT)).toBe(true)
    expect(versionAtLeast('v0.45.1', MIN_TARGETED_INTERRUPT)).toBe(true)
    expect(versionAtLeast('0.3.40', MIN_TARGETED_INTERRUPT)).toBe(false)
    expect(versionAtLeast('0.29.9', MIN_TARGETED_INTERRUPT)).toBe(false)
    expect(versionAtLeast('', MIN_TARGETED_INTERRUPT)).toBe(false)
    expect(versionAtLeast('unknown', MIN_TARGETED_INTERRUPT)).toBe(false)
  })

  it('counts 0.3.68, the real ComfyUI form, as below 0.30.0 [review CU-5a item 4]', () => {
    expect(versionAtLeast('0.3.68', MIN_TARGETED_INTERRUPT)).toBe(false)
  })
})

describe('a run that runs out of time [SPEC 6.10.12, 6.10.14; review CU-5a item 1]', () => {
  it('removes its own run and interrupts it, when it was seen working on a new enough server', async () => {
    const { id, error, posts, recorded } = await timedOut('0.45.0', 'in_progress')
    expect(error.message).toBe('The run ran out of time; its own run was cancelled')
    const cancels = recorded.calls.filter(
      (c) => c.name === 'removeFromQueue' || c.name === 'interrupt',
    )
    expect(cancels).toEqual([
      { name: 'removeFromQueue', arg: id },
      { name: 'interrupt', arg: id },
    ])
    expect(posts.slice(-2)).toEqual(['/queue', '/interrupt'])
    expect(foreignCancels(recorded.calls)).toEqual([])
  })

  it('sends no interrupt while the run is still waiting in the queue', async () => {
    const { error, posts, printed } = await timedOut('0.45.0', 'pending')
    expect(posts).toEqual(['/prompt', '/queue'])
    expect(printed).toEqual([MAY_STILL_RUN])
    expect(error.message).toBe(
      'The run ran out of time; its own run was taken off the queue, not interrupted',
    )
  })

  it('sends no interrupt to a server older than 0.30.0', async () => {
    const { posts, printed } = await timedOut('0.29.9', 'in_progress')
    expect(posts).toEqual(['/prompt', '/queue'])
    expect(printed).toEqual([MAY_STILL_RUN])
  })

  it("sends no interrupt when the server's version cannot be read", async () => {
    const { posts, printed } = await timedOut('not a version', 'in_progress')
    expect(posts).toEqual(['/prompt', '/queue'])
    expect(printed).toEqual([MAY_STILL_RUN])
  })

  it('sends no interrupt when /api/jobs answers 404, though the queue shows it running', async () => {
    const { posts, printed } = await timedOut('0.45.0', 'none')
    expect(posts).toEqual(['/prompt', '/queue'])
    expect(printed).toEqual([MAY_STILL_RUN])
  })

  it('sends no interrupt when no version is passed', async () => {
    stand = await startComfyStandIn()
    const id = randomUUID()
    stand.reply(`GET /api/jobs/${id}`, { json: { status: 'in_progress' } })
    const recorded = recordCalls(createComfyClient({ origin: stand.origin, ownPorts: () => [] }))
    const print = makePrinter(stand.origin, () => undefined)
    const run = runGraph(recorded.client, spec, graph, id, print, fakeTiming(10_000), 1_000)
    await expect(run).rejects.toThrow('not interrupted')
    expect(stand.seen.some((r) => r.path === '/interrupt')).toBe(false)
  })
})
