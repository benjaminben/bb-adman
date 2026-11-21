import { describe, it, expect, afterEach } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'
import {
  PROMPT_ID,
  comfyContext,
  fakeTiming,
  finishRun,
  historyEntry,
  requestLines,
  serveNeeds,
  servePicture,
} from '../../../../helpers/comfy-run'
import { comfyImage } from '@/main/providers/comfyui/image'
import { createServerChecks } from '@/main/providers/comfyui/needs'
import type { RunTiming } from '@/main/providers/comfyui/run'
import { mossTextToImage as moss } from '@/main/providers/comfyui/workflows/moss'
import { ProviderFailure } from '@/main/providers/types'

let stand: StandIn
afterEach(async () => {
  await stand.close()
})

async function standIn(): Promise<StandIn> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  servePicture(stand)
  return stand
}

function failureOf(s: StandIn, timing: RunTiming, origin: () => string | null = () => s.origin) {
  const provider = comfyImage(comfyContext(origin), { timing, checks: createServerChecks() })
  const input = { prompt: 'p', references: [], width: 1080, height: 1080, count: 1 }
  return provider.generate(input).then(
    () => {
      throw new Error('The run did not fail')
    },
    (e: unknown) => {
      if (!(e instanceof ProviderFailure)) throw e
      return e.error
    },
  )
}

const errorEntry = (exception_type: string, exception_message: string) => ({
  status: {
    status_str: 'error',
    completed: false,
    messages: [['execution_error', { exception_type, exception_message, traceback: ['/srv/x'] }]],
  },
  outputs: {},
})

// A clock whose every wait moves it on by `step` ms.
function bigSteps(step: number): RunTiming {
  let clock = 0
  return {
    now: () => clock,
    newId: () => PROMPT_ID,
    sleep: async () => {
      clock += step
    },
  }
}

describe('every row of 6.10.9 from a stand-in answer [SPEC 6.10.9, 14 CU-4]', () => {
  it('no address saved: address_needed, and nothing is sent', async () => {
    const s = await standIn()
    expect(await failureOf(s, fakeTiming().timing, () => null)).toMatchObject({
      kind: 'other',
      reason: 'address_needed',
    })
    expect(s.seen).toEqual([])
  })

  it('a 400 from /prompt: server_refused, with the cleaned words as detail and no poll', async () => {
    const s = await standIn()
    s.reply('POST /prompt', {
      status: 400,
      json: {
        error: { type: 'invalid_prompt', message: 'Bad\u001b[1m prompt', details: '' },
        node_errors: { '4': { errors: [{ message: 'Value missing', traceback: '/home/x' }] } },
      },
    })
    expect(await failureOf(s, fakeTiming().timing)).toEqual({
      kind: 'other',
      reason: 'server_refused',
      detail: 'Bad prompt\nValue missing',
    })
    expect(requestLines(s).at(-1)).toBe('POST /prompt')
  })

  it('out of memory in the run: out_of_memory, never the traceback', async () => {
    const s = await standIn()
    finishRun(s, PROMPT_ID, errorEntry('torch.OutOfMemoryError', 'CUDA out of memory'))
    const error = await failureOf(s, fakeTiming().timing)
    expect(error).toEqual({
      kind: 'other',
      reason: 'out_of_memory',
      detail: 'torch.OutOfMemoryError: CUDA out of memory',
    })
  })

  it('any other error in the run: run_failed', async () => {
    const s = await standIn()
    finishRun(s, PROMPT_ID, errorEntry('ValueError', 'no such sampler'))
    expect(await failureOf(s, fakeTiming().timing)).toMatchObject({ reason: 'run_failed' })
  })

  it('in neither the queue nor the history on two polls in a row: server_stopped', async () => {
    const s = await standIn()
    s.reply(`GET /api/jobs/${PROMPT_ID}`, { status: 404, json: {} })
    expect(await failureOf(s, fakeTiming().timing)).toMatchObject({
      kind: 'other',
      reason: 'server_stopped',
    })
    expect(requestLines(s).filter((l) => l === 'GET /queue')).toHaveLength(2)
  })

  it('a failed poll is not a failure: the run goes on when the server answers again', async () => {
    const s = await standIn()
    s.reply(`GET /history/${PROMPT_ID}`, { vanish: true })
    const { timing } = fakeTiming((step) => {
      if (step === 4) finishRun(s, PROMPT_ID, historyEntry(moss.slots.outputNode))
    })
    const provider = comfyImage(
      comfyContext(() => s.origin),
      { timing, checks: createServerChecks() },
    )
    const input = { prompt: 'p', references: [], width: 1080, height: 1080, count: 1 }
    await expect(provider.generate(input)).resolves.toHaveLength(1)
  })

  it('polls failing for 5 minutes: lost_contact, kind offline [FR-268]', async () => {
    const s = await standIn()
    s.reply(`GET /history/${PROMPT_ID}`, { vanish: true })
    expect(await failureOf(s, bigSteps(60_000))).toMatchObject({
      kind: 'offline',
      reason: 'lost_contact',
    })
  })

  it('over the waiting limit in the queue: too_long, kind timeout', async () => {
    const s = await standIn()
    expect(await failureOf(s, bigSteps(60 * 60_000))).toMatchObject({
      kind: 'timeout',
      reason: 'too_long',
    })
    expect(requestLines(s).filter((l) => l.startsWith('GET /api/jobs/')).length).toBe(13)
  })

  it('over the working limit for a picture: too_long', async () => {
    const s = await standIn()
    s.reply(`GET /api/jobs/${PROMPT_ID}`, { json: { status: 'in_progress' } })
    expect(await failureOf(s, bigSteps(10 * 60_000))).toMatchObject({ reason: 'too_long' })
    expect(requestLines(s).filter((l) => l.startsWith('GET /api/jobs/')).length).toBe(5)
  })

  it('a result that is not a picture: bad_result', async () => {
    const s = await standIn()
    finishRun(s, PROMPT_ID, historyEntry(moss.slots.outputNode))
    s.reply('GET /view', { body: 'not a picture' })
    expect(await failureOf(s, fakeTiming().timing)).toMatchObject({ reason: 'bad_result' })
  })

  it('a finished run with no file at its output node: bad_result', async () => {
    const s = await standIn()
    finishRun(s, PROMPT_ID, historyEntry('99'))
    expect(await failureOf(s, fakeTiming().timing)).toMatchObject({ reason: 'bad_result' })
    expect(requestLines(s).some((l) => l.startsWith('GET /view'))).toBe(false)
  })

  it('the address changed during the run: address_changed, and nothing more is sent', async () => {
    const s = await standIn()
    let origin: string | null = s.origin
    const { timing } = fakeTiming(() => {
      origin = 'http://192.0.2.7:8188'
    })
    const sentBefore = () => requestLines(s).indexOf('POST /prompt')
    expect(await failureOf(s, timing, () => origin)).toMatchObject({
      kind: 'other',
      reason: 'address_changed',
    })
    expect(requestLines(s).length).toBe(sentBefore() + 1)
  })

  it('holds no address in any failure', async () => {
    const s = await standIn()
    s.reply('GET /view', { body: 'not a picture' })
    finishRun(s, PROMPT_ID, historyEntry(moss.slots.outputNode))
    const text = JSON.stringify(await failureOf(s, fakeTiming().timing))
    expect(text).not.toContain(s.origin)
    expect(text).not.toContain(String(s.port))
  })
})
