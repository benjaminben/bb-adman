// P5-7 (security class): how a ComfyUI extend fails, against the stand-in only, with the
// test-only `trial` copy of `moss-extend`. Nothing here contacts a real server.
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
import { extendInput, extender, trialExtend } from '../../../../helpers/comfy-extend'
import { comfyImage } from '@/main/providers/comfyui/image'
import { createServerChecks } from '@/main/providers/comfyui/needs'
import { NON_DRAFT_WORKFLOWS } from '@/main/providers/comfyui/workflows'
import { ProviderFailure, type ProviderError } from '@/main/providers/types'

let stand: StandIn
afterEach(async () => {
  await stand.close()
})

async function standIn(): Promise<StandIn> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  stand.reply('GET /models/loras', { json: ['moss_image_edit_lora_rank_64_bf16.safetensors'] })
  servePicture(stand)
  finishRun(stand, PROMPT_ID, historyEntry(trialExtend.slots.outputNode))
  return stand
}

const centred = () => extendInput({ x: 420, y: 0, width: 1080, height: 1080 })

async function failureOf(run: Promise<unknown>): Promise<ProviderError> {
  const e = await run.then(
    () => new Error('The run did not fail'),
    (thrown: unknown) => thrown,
  )
  if (!(e instanceof ProviderFailure)) throw e
  return e.error
}

describe('a ComfyUI extend that fails [P5-7, SPEC 6.10.9] (security class)', () => {
  it('a 400 from /prompt: server_refused with the cleaned words only, and no poll', async () => {
    const s = await standIn()
    s.reply('POST /prompt', {
      status: 400,
      json: {
        error: { type: 'invalid_prompt', message: 'Bad\u001b[1m pad', details: '' },
        node_errors: { '12': { errors: [{ message: 'Value too big', traceback: '/home/x' }] } },
      },
    })
    expect(await failureOf(extender(s).extend(centred()))).toEqual({
      kind: 'other',
      reason: 'server_refused',
      detail: 'Bad pad\nValue too big',
    })
    expect(requestLines(s).at(-1)).toBe('POST /prompt')
  })

  it('no address saved: address_needed, and nothing is sent', async () => {
    const s = await standIn()
    const provider = comfyImage(
      comfyContext(() => null),
      { timing: fakeTiming().timing, checks: createServerChecks(), workflows: [trialExtend] },
    )
    expect(await failureOf(provider.extend(centred()))).toMatchObject({ reason: 'address_needed' })
    expect(s.seen).toEqual([])
  })

  it('the address changed after the check: address_changed, with no upload', async () => {
    const s = await standIn()
    let origin: string | null = s.origin
    const real = createServerChecks()
    const checks = {
      async run(o: string, client: Parameters<typeof real.run>[1]) {
        const result = await real.run(o, client, [...NON_DRAFT_WORKFLOWS, trialExtend])
        origin = 'http://127.0.0.1:1'
        return result
      },
    }
    const ctx = comfyContext(() => origin)
    const provider = comfyImage(ctx, {
      timing: fakeTiming().timing,
      checks,
      workflows: [trialExtend],
    })
    expect(await failureOf(provider.extend(centred()))).toMatchObject({ reason: 'address_changed' })
    expect(requestLines(s)).not.toContain('POST /upload/image')
  })

  it('a redirect from the upload is not followed: redirect_refused, and no submit', async () => {
    const s = await standIn()
    s.reply('POST /upload/image', { status: 307, headers: { location: '/elsewhere' } })
    expect(await failureOf(extender(s).extend(centred()))).toMatchObject({
      reason: 'redirect_refused',
    })
    const lines = requestLines(s)
    expect(lines.some((l) => l.includes('/elsewhere'))).toBe(false)
    expect(lines).not.toContain('POST /prompt')
  })

  it('an upload answer naming a path outside the input folder: bad_result, and no submit', async () => {
    const s = await standIn()
    s.reply('POST /upload/image', { json: { name: '../../x.png', subfolder: '', type: 'input' } })
    expect(await failureOf(extender(s).extend(centred()))).toMatchObject({ reason: 'bad_result' })
    expect(requestLines(s)).not.toContain('POST /prompt')
  })

  it('a result whose file name climbs out of its folder: bad_result, and nothing is fetched', async () => {
    const s = await standIn()
    const entry = historyEntry(trialExtend.slots.outputNode)
    const output = entry.outputs[trialExtend.slots.outputNode]
    if (output) output.images = [{ filename: '../secret.png', subfolder: '', type: 'temp' }]
    finishRun(s, PROMPT_ID, entry)
    expect(await failureOf(extender(s).extend(centred()))).toMatchObject({ reason: 'bad_result' })
    expect(requestLines(s)).not.toContain('GET /view')
  })

  it('result bytes that are not a picture: bad_result', async () => {
    const s = await standIn()
    servePicture(s, new TextEncoder().encode('<html>not a picture</html>'))
    expect(await failureOf(extender(s).extend(centred()))).toMatchObject({ reason: 'bad_result' })
  })

  it('a picture that does not sit inside the canvas is refused before anything is sent', async () => {
    const s = await standIn()
    const outside = extendInput({ x: -200, y: 0, width: 1080, height: 1080 })
    await expect(extender(s).extend(outside)).rejects.toThrow(
      'The picture does not sit inside the canvas',
    )
    expect(s.seen).toEqual([])
  })
})
