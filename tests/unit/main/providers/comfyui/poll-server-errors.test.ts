// F-16: a 5xx answer to a poll is a failed poll, tried again until LOST_CONTACT_MS, then
// lost_contact (SPEC 6.10.6 "A short break", FR-268). Pictures and video alike.
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
import { comfyVideo } from '@/main/providers/comfyui/video'
import { createServerChecks } from '@/main/providers/comfyui/needs'
import { LOST_CONTACT_MS } from '@/main/providers/comfyui/limits'
import type { RunTiming } from '@/main/providers/comfyui/run'
import { mossTextToImage as moss } from '@/main/providers/comfyui/workflows/moss'
import { ProviderFailure } from '@/main/providers/types'

let stand: StandIn
afterEach(async () => {
  await stand.close()
})

const picture = { prompt: 'p', references: [], width: 1080, height: 1080, count: 1 }
const video = { image: null, references: [], prompt: 'p', durationMs: 2_000, width: 64, height: 64 }

async function standIn(): Promise<StandIn> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  servePicture(stand)
  return stand
}

function generate(s: StandIn, timing: RunTiming) {
  const provider = comfyImage(
    comfyContext(() => s.origin),
    { timing, checks: createServerChecks() },
  )
  return provider.generate(picture)
}

const historyPolls = (s: StandIn) =>
  requestLines(s).filter((l) => l === `GET /history/${PROMPT_ID}`).length

describe('a 5xx poll answer is a failed poll [SPEC 6.10.6, FR-268, phase-02 F-16]', () => {
  it('a picture poll answered 500 three times, then a result: the run succeeds', async () => {
    const s = await standIn()
    s.reply(`GET /history/${PROMPT_ID}`, { status: 500, json: {} })
    const { timing } = fakeTiming(() => {
      if (historyPolls(s) === 3) finishRun(s, PROMPT_ID, historyEntry(moss.slots.outputNode))
    })
    await expect(generate(s, timing)).resolves.toHaveLength(1)
    expect(historyPolls(s)).toBe(4)
  })

  it.each([500, 502, 503])(
    'picture polls answered %i for over 5 minutes: lost_contact',
    async (status) => {
      const s = await standIn()
      s.reply(`GET /history/${PROMPT_ID}`, { status, json: {} })
      const { timing } = fakeTiming()
      const error = await generate(s, timing).then(
        () => null,
        (e: unknown) => (e instanceof ProviderFailure ? e.error : e),
      )
      expect(error).toMatchObject({ kind: 'offline', reason: 'lost_contact' })
    },
  )

  it('a 500 from the job route or the queue is a failed poll too', async () => {
    const s = await standIn()
    s.reply(`GET /api/jobs/${PROMPT_ID}`, { status: 503, json: {} })
    const { timing } = fakeTiming((step) => {
      if (step === 3) s.reply(`GET /api/jobs/${PROMPT_ID}`, { status: 404, json: {} })
      if (step === 3) s.reply('GET /queue', { status: 500, json: {} })
      if (step === 5) finishRun(s, PROMPT_ID, historyEntry(moss.slots.outputNode))
    })
    await expect(generate(s, timing)).resolves.toHaveLength(1)
  })

  it('a video check answered 500 keeps its last state, and lost_contact after 5 minutes', async () => {
    stand = await startComfyStandIn()
    serveNeeds(stand)
    const { timing } = fakeTiming()
    const v = comfyVideo(
      comfyContext(() => stand.origin),
      {
        timing,
        checks: createServerChecks(),
      },
    )
    const { remoteJobId: id } = await v.start(video)
    stand.reply(`GET /api/jobs/${id}`, { json: { status: 'in_progress' } })
    expect((await v.check(id)).status).toBe('running')
    stand.reply(`GET /history/${id}`, { status: 500, json: {} })
    expect(await v.check(id)).toEqual({ status: 'running' })
    await timing.sleep(LOST_CONTACT_MS)
    expect(await v.check(id)).toMatchObject({
      status: 'failed',
      error: { kind: 'offline', reason: 'lost_contact' },
    })
  })

  it('a 4xx poll answer other than 404 still ends the run at once', async () => {
    const s = await standIn()
    s.reply(`GET /history/${PROMPT_ID}`, { status: 418, json: {} })
    const error = await generate(s, fakeTiming().timing).then(
      () => null,
      (e: unknown) => (e instanceof ProviderFailure ? e.error : e),
    )
    expect(error).toEqual({ kind: 'other', detail: 'HTTP 418' })
    expect(historyPolls(s)).toBe(1)
  })
})
