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
import { createServerChecks } from '@/main/providers/comfyui/needs'
import { mossTextToImage as moss } from '@/main/providers/comfyui/workflows/moss'
import { fitSize } from '@/shared/comfy/fit-size'
import type { RunProgress } from '@/main/providers/types'

let stand: StandIn
afterEach(async () => {
  await stand.close()
})

async function mossStandIn(): Promise<StandIn> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  servePicture(stand)
  return stand
}

function generate(
  s: StandIn,
  onSleep?: (step: number) => void,
  onProgress?: (p: RunProgress) => void,
) {
  const { timing } = fakeTiming(onSleep)
  const provider = comfyImage(
    comfyContext(() => s.origin),
    { timing, checks: createServerChecks() },
  )
  const input = { prompt: 'a lamp', references: [], width: 1080, height: 1350, count: 1 }
  return provider.generate(input, { ...(onProgress && { onProgress }) })
}

const graphSent = (s: StandIn) => {
  const body = s.seen.find((r) => r.path === '/prompt')?.body.toString('utf8') ?? '{}'
  return JSON.parse(body) as {
    prompt: Record<string, { inputs: Record<string, unknown> }>
    prompt_id: string
  }
}

describe('a picture from a prompt alone, MOSS-Image [SPEC 6.10.6, 14 1.41]', () => {
  it('uploads nothing and returns the picture with the workflow model', async () => {
    const s = await mossStandIn()
    finishRun(s, PROMPT_ID, historyEntry(moss.slots.outputNode))
    const [result] = await generate(s)
    expect(result).toEqual({
      bytes: RESULT_PNG,
      mime: 'image/png',
      model: moss.model.mainFile,
      details: {
        models: moss.needs.models.map((m) => m.file),
        workflow: { id: moss.id, version: moss.version },
      },
    })
    expect(requestLines(s)).not.toContain('POST /upload/image')
  })

  it('fills the prompt and the nearest size the model makes for the variant [SPEC 6.10.5]', async () => {
    const s = await mossStandIn()
    finishRun(s, PROMPT_ID, historyEntry(moss.slots.outputNode))
    await generate(s)
    const { prompt, prompt_id } = graphSent(s)
    const size = fitSize({ width: 1080, height: 1350 }, moss.size)
    expect(prompt_id).toBe(PROMPT_ID)
    expect(prompt['4']?.inputs.text).toBe('a lamp')
    expect(prompt['6']?.inputs).toMatchObject({ width: size.width, height: size.height })
  })

  it('reads the picture at its own output node only, under whichever list name', async () => {
    const s = await mossStandIn()
    finishRun(s, PROMPT_ID, {
      outputs: {
        '99': { images: [{ filename: 'other.png', subfolder: '', type: 'temp' }] },
        [moss.slots.outputNode]: {
          some_list: [{ filename: 'mine.png', subfolder: 'x', type: 'temp' }],
        },
      },
    })
    await generate(s)
    expect(requestLines(s)).toContain('GET /view?filename=mine.png&subfolder=x&type=temp')
  })

  it('reports waiting with the place in the queue, then working, each once [FR-269, O-6]', async () => {
    const s = await mossStandIn()
    s.reply('GET /api/jobs/' + PROMPT_ID, { status: 404, json: {} })
    const pending = [
      [1, 'x'],
      [2, PROMPT_ID],
    ]
    s.reply('GET /queue', { json: { queue_running: [], queue_pending: pending } })
    const shown: RunProgress[] = []
    await generate(
      s,
      (step) => {
        if (step === 3) {
          s.reply('GET /queue', { json: { queue_running: [[3, PROMPT_ID]], queue_pending: [] } })
        }
        if (step === 5) finishRun(s, PROMPT_ID, historyEntry(moss.slots.outputNode))
      },
      (p) => shown.push(p),
    )
    expect(shown).toEqual([{ stage: 'waiting', queuePosition: 2 }, { stage: 'working' }])
  })

  it('reads waiting and working from the job route when the server has one', async () => {
    const s = await mossStandIn()
    const shown: RunProgress[] = []
    await generate(
      s,
      (step) => {
        if (step === 2) s.reply(`GET /api/jobs/${PROMPT_ID}`, { json: { status: 'in_progress' } })
        if (step === 3) finishRun(s, PROMPT_ID, historyEntry(moss.slots.outputNode))
      },
      (p) => shown.push(p),
    )
    expect(shown).toEqual([{ stage: 'waiting' }, { stage: 'working' }])
  })
})
