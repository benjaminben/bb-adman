import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'
import {
  PROMPT_ID,
  RESULT_PNG,
  comfyContext,
  fakeTiming,
  finishRun,
  historyEntry,
  requestLines,
  serveNeeds,
  servePicture,
} from '../../../../helpers/comfy-run'
import { comfyImage } from '@/main/providers/comfyui/image'
import { cancelOwnRun, takesTargetedInterrupt } from '@/main/providers/comfyui/cancel'
import { createComfyClient } from '@/main/providers/comfyui/client'
import { createServerChecks } from '@/main/providers/comfyui/needs'
import { rememberOwnId } from '@/main/providers/comfyui/own-ids'
import { POLL_MS } from '@/main/providers/comfyui/limits'
import type { RunTiming } from '@/main/providers/comfyui/run'
import { mossTextToImage as moss } from '@/main/providers/comfyui/workflows/moss'
import { ProviderCancelled, ProviderFailure } from '@/main/providers/types'

let stand: StandIn
afterEach(async () => {
  await stand.close()
})

const input = { prompt: 'p', references: [], width: 1080, height: 1080, count: 1 }
const posts = (s: StandIn) => s.seen.filter((r) => r.method === 'POST' && r.path !== '/prompt')

function cancelledRun(s: StandIn, onSleep: (controller: AbortController) => void) {
  const controller = new AbortController()
  const { timing } = fakeTiming(() => onSleep(controller))
  const provider = comfyImage(
    comfyContext(() => s.origin),
    { timing, checks: createServerChecks() },
  )
  return provider.generate(input, { signal: controller.signal })
}

describe('cancel through opts.signal [SPEC 6.11.2, 14 CU-4]', () => {
  it('sends nothing when the signal fired before the run started', async () => {
    stand = await startComfyStandIn()
    const controller = new AbortController()
    controller.abort()
    const provider = comfyImage(comfyContext(() => stand.origin))
    await expect(provider.generate(input, { signal: controller.signal })).rejects.toBeInstanceOf(
      ProviderCancelled,
    )
    expect(stand.seen).toEqual([])
  })

  it('removes a queued run from the queue with exactly its own ID', async () => {
    stand = await startComfyStandIn()
    serveNeeds(stand)
    stand.reply(`GET /api/jobs/${PROMPT_ID}`, { status: 404, json: {} })
    stand.reply('GET /queue', { json: { queue_running: [], queue_pending: [[1, PROMPT_ID]] } })
    const run = cancelledRun(stand, (c) => c.abort())
    await expect(run).rejects.toBeInstanceOf(ProviderCancelled)
    expect(posts(stand).map((r) => [r.path, JSON.parse(r.body.toString('utf8'))])).toEqual([
      ['/queue', { delete: [PROMPT_ID] }],
    ])
  })

  it('interrupts a running run by its ID on a server that takes one', async () => {
    stand = await startComfyStandIn()
    serveNeeds(stand)
    stand.reply('GET /queue', { json: { queue_running: [[1, PROMPT_ID]], queue_pending: [] } })
    let polls = 0
    const run = cancelledRun(stand, (c) => {
      polls += 1
      if (polls === 2) c.abort()
    })
    await expect(run).rejects.toBeInstanceOf(ProviderCancelled)
    expect(posts(stand).map((r) => [r.path, JSON.parse(r.body.toString('utf8'))])).toEqual([
      ['/interrupt', { prompt_id: PROMPT_ID }],
    ])
  })
})

describe('the own-ID set [SPEC 14 1.43 K-7] (security class)', () => {
  it('sends nothing for an ID this process did not submit, and answers unknown', async () => {
    stand = await startComfyStandIn()
    const client = createComfyClient({ origin: stand.origin, ownPorts: () => [] })
    const foreign = '3b9e1c2d-5f6a-4b7c-8d9e-0f1a2b3c4d5e'
    expect(await cancelOwnRun(client, foreign, '0.45.0')).toBe('unknown')
    expect(requestLines(stand).filter((l) => l.startsWith('POST'))).toEqual([])
    expect(stand.seen).toEqual([])
  })

  it('takes a targeted interrupt only from 0.30.0, and not when the version cannot be read', () => {
    expect(takesTargetedInterrupt('0.30.0')).toBe(true)
    expect(takesTargetedInterrupt('v0.45.1')).toBe(true)
    expect(takesTargetedInterrupt('0.29.9')).toBe(false)
    expect(takesTargetedInterrupt('unknown')).toBe(false)
    expect(takesTargetedInterrupt(undefined)).toBe(false)
  })

  it('does not interrupt on a server older than MIN_TARGETED_INTERRUPT', async () => {
    stand = await startComfyStandIn()
    stand.reply('GET /queue', { json: { queue_running: [[1, PROMPT_ID]], queue_pending: [] } })
    const client = createComfyClient({ origin: stand.origin, ownPorts: () => [] })
    rememberOwnId(PROMPT_ID)
    expect(await cancelOwnRun(client, PROMPT_ID, '0.29.0')).toBe('unknown')
    expect(requestLines(stand)).toEqual(['GET /queue'])
  })
})

// F-15: a clock whose every wait moves it on by `step` ms; `onSleep` runs at each wait.
function stoppedRun(s: StandIn, step: number, onSleep: (n: number, c: AbortController) => void) {
  const controller = new AbortController()
  let clock = 0
  let n = 0
  const timing: RunTiming = {
    now: () => clock,
    newId: () => PROMPT_ID,
    sleep: async () => {
      clock += step
      n += 1
      onSleep(n, controller)
    },
  }
  const provider = comfyImage(
    comfyContext(() => s.origin),
    { timing, checks: createServerChecks() },
  )
  return provider.generate(input, { signal: controller.signal })
}

describe('what a picture cancel ends with [SPEC cancel.md, 14 F-15]', () => {
  it('finished: the picture is fetched and returned, and nothing is removed or interrupted', async () => {
    stand = await startComfyStandIn()
    serveNeeds(stand)
    servePicture(stand)
    stand.reply(`GET /api/jobs/${PROMPT_ID}`, { status: 404, json: {} })
    stand.reply('GET /queue', { json: { queue_running: [], queue_pending: [] } })
    const run = stoppedRun(stand, POLL_MS, (n, c) => {
      if (n !== 1) return
      finishRun(stand, PROMPT_ID, historyEntry(moss.slots.outputNode))
      c.abort()
    })
    const [result] = await run
    expect(result?.bytes).toEqual(RESULT_PNG)
    expect(posts(stand)).toEqual([])
  })

  it('unknown: polling goes on, and a picture that arrives later is returned', async () => {
    stand = await startComfyStandIn()
    serveNeeds(stand)
    servePicture(stand)
    stand.reply(`GET /api/jobs/${PROMPT_ID}`, { json: { status: 'in_progress' } })
    stand.reply('GET /queue', { status: 500, json: {} })
    const run = stoppedRun(stand, POLL_MS, (n, c) => {
      if (n === 1) c.abort()
      if (n === 6) finishRun(stand, PROMPT_ID, historyEntry(moss.slots.outputNode))
    })
    const [result] = await run
    expect(result?.bytes).toEqual(RESULT_PNG)
    expect(requestLines(stand).filter((l) => l === 'GET /queue')).toHaveLength(1)
    expect(posts(stand)).toEqual([])
  })

  it('unknown: a run that never ends still meets its own working limit', async () => {
    stand = await startComfyStandIn()
    serveNeeds(stand)
    stand.reply(`GET /api/jobs/${PROMPT_ID}`, { json: { status: 'in_progress' } })
    stand.reply('GET /queue', { status: 500, json: {} })
    const run = stoppedRun(stand, 10 * 60_000, (n, c) => {
      if (n === 1) c.abort()
    })
    const failure = await run.catch((e: unknown) => e)
    expect(failure).toBeInstanceOf(ProviderFailure)
    expect(failure).toMatchObject({ error: { reason: 'too_long' } })
  })

  it('stopped: the run ends cancelled', async () => {
    stand = await startComfyStandIn()
    serveNeeds(stand)
    stand.reply(`GET /api/jobs/${PROMPT_ID}`, { status: 404, json: {} })
    stand.reply('GET /queue', { json: { queue_running: [], queue_pending: [[1, PROMPT_ID]] } })
    const run = stoppedRun(stand, POLL_MS, (n, c) => {
      if (n === 1) c.abort()
    })
    await expect(run).rejects.toBeInstanceOf(ProviderCancelled)
  })
})
