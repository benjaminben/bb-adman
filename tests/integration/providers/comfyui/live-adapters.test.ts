// CU-9 [REQ: FR-269]: the picture and video adapters open the run's live connection on the
// run's own origin after the submission, pass on its percent, and close it when the run ends.
// The stand-in plays the ComfyUI routes and the live connection on one port.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../../helpers/comfy-stand-in'
import { liveSide, textFrame, type LiveSide } from '../../../helpers/comfy-live-stand-in'
import {
  PROMPT_ID,
  comfyContext,
  fakeTiming,
  finishRun,
  historyEntry,
  serveNeeds,
  servePicture,
  videoHistoryEntry,
} from '../../../helpers/comfy-run'
import { comfyImage, workflowForRun } from '@/main/providers/comfyui/image'
import { comfyVideo } from '@/main/providers/comfyui/video'
import { createServerChecks } from '@/main/providers/comfyui/needs'
import type { RunProgress } from '@/main/providers/types'

let stand: StandIn
let side: LiveSide | null = null
afterEach(async () => {
  // The stand-in's own close does not know the upgraded sockets.
  side?.closeSockets()
  await stand.close()
})

const progress = (value: number) =>
  textFrame({ type: 'progress', data: { value, max: 4, prompt_id: PROMPT_ID } })
const until = (test: () => boolean) => vi.waitFor(() => expect(test()).toBe(true), 3000)

async function standWithLive(): Promise<LiveSide> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  const made = liveSide()
  stand.upgrade((req, socket) => made.onUpgrade(req, socket))
  side = made
  return made
}

describe('the picture adapter with a live connection [CU-9]', () => {
  it('passes on the live percent and closes the connection when the run ends', async () => {
    const side = await standWithLive()
    servePicture(stand)
    const seen: RunProgress[] = []
    const { timing } = fakeTiming(async (step) => {
      if (step === 1) {
        await until(() => side.open() === 1)
        side.send(progress(2))
        await until(() => seen.some((p) => p.fraction === 0.5))
      }
      if (step === 2)
        finishRun(stand, PROMPT_ID, historyEntry(workflowForRun('image').slots.outputNode))
    })
    const provider = comfyImage(
      comfyContext(() => stand.origin),
      {
        timing,
        checks: createServerChecks(),
      },
    )
    const input = { prompt: 'p', references: [], width: 1080, height: 1080, count: 1 }
    await provider.generate(input, { onProgress: (p) => seen.push(p) })
    expect(seen).toContainEqual({ stage: 'working', fraction: 0.5 })
    expect(side.upgrades[0]?.path).toMatch(/^\/ws\?clientId=[0-9a-f-]{36}$/)
    await until(() => side.open() === 0)
  })
})

describe('the video adapter with a live connection [CU-9]', () => {
  const input = {
    image: null,
    references: [],
    prompt: 'p',
    durationMs: 2_000,
    width: 64,
    height: 64,
  }

  async function startedVideo() {
    const side = await standWithLive()
    const { timing } = fakeTiming()
    const v = comfyVideo(
      comfyContext(() => stand.origin),
      { timing, checks: createServerChecks() },
    )
    const { remoteJobId } = await v.start(input)
    await until(() => side.open() === 1)
    return { v, id: remoteJobId, side }
  }

  it('a running check carries the live percent', async () => {
    const { v, id, side } = await startedVideo()
    stand.reply(`GET /api/jobs/${id}`, { json: { status: 'in_progress' } })
    expect(await v.check(id)).toEqual({ status: 'running' })
    side.send(progress(3))
    await vi.waitFor(async () =>
      expect(await v.check(id)).toEqual({ status: 'running', progress: 0.75 }),
    )
  })

  it('closes the connection when a check sees the run end', async () => {
    const { v, id, side } = await startedVideo()
    const spec = workflowForRun('video', { firstFrame: false, references: false })
    finishRun(stand, id, videoHistoryEntry(spec.slots.outputNode, id))
    expect((await v.check(id)).status).toBe('succeeded')
    await until(() => side.open() === 0)
  })

  it('closes the connection when the run is cancelled', async () => {
    const { v, id, side } = await startedVideo()
    await v.cancel(id)
    await until(() => side.open() === 0)
  })
})
