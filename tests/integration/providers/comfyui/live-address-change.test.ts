// CU-9b (security class) [REQ: FR-269]: once the saved address is no longer the run's
// origin, nothing more reaches the old address, the live connection's handshake included
// (spec/comfyui.md "The address during a run", "Live progress"). The address is changed at
// the exact point the live connection was decided on: right after the run made its socket,
// before any of its bytes were sent. A connection already open is closed by the change.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../../helpers/comfy-stand-in'
import { liveSide, textFrame, type LiveSide } from '../../../helpers/comfy-live-stand-in'
import {
  PROMPT_ID,
  comfyContext,
  fakeTiming,
  requestLines,
  serveNeeds,
} from '../../../helpers/comfy-run'
import { comfyImage } from '@/main/providers/comfyui/image'
import { comfyVideo } from '@/main/providers/comfyui/video'
import { createServerChecks } from '@/main/providers/comfyui/needs'
import type { RunProgress } from '@/main/providers/types'

// Runs once, right after the app made its live socket.
const made = vi.hoisted(() => ({ hook: null as (() => void) | null }))
vi.mock('ws', async (importOriginal) => {
  const real = (await importOriginal<typeof import('ws')>()).default
  class Watched extends real {
    constructor(...args: ConstructorParameters<typeof real>) {
      super(...args)
      const hook = made.hook
      made.hook = null
      hook?.()
    }
  }
  return { default: Watched }
})

let stand: StandIn
let side: LiveSide
let origin: string | null
afterEach(async () => {
  made.hook = null
  side.closeSockets()
  await stand.close()
})

const OTHER = 'http://192.0.2.9:8188'
// Long enough for a handshake on this computer to reach the stand-in, had one been sent.
const settle = () => new Promise((done) => setTimeout(done, 300))
const until = (test: () => boolean) => vi.waitFor(() => expect(test()).toBe(true), 3000)

async function standWithLive(): Promise<void> {
  stand = await startComfyStandIn()
  serveNeeds(stand)
  side = liveSide()
  stand.upgrade((req, socket) => side.onUpgrade(req, socket))
  origin = stand.origin
}

const linesAfterPrompt = () => {
  const lines = requestLines(stand)
  return lines.slice(lines.indexOf('POST /prompt') + 1)
}

const videoInput = {
  image: null,
  references: [],
  prompt: 'p',
  durationMs: 2_000,
  width: 64,
  height: 64,
}

describe('the address changes between the submission and the live open [CU-9b]', () => {
  it('a picture run sends no handshake to the old address and fails address_changed', async () => {
    await standWithLive()
    made.hook = () => {
      origin = OTHER
    }
    // The run waits before its first poll, so a handshake already under way would arrive.
    const { timing } = fakeTiming(async (step) => {
      if (step === 1) await settle()
    })
    const provider = comfyImage(
      comfyContext(() => origin),
      { timing, checks: createServerChecks() },
    )
    const input = { prompt: 'p', references: [], width: 1080, height: 1080, count: 1 }
    await expect(provider.generate(input)).rejects.toMatchObject({
      error: { reason: 'address_changed' },
    })
    expect(side.upgrades).toEqual([])
    expect(linesAfterPrompt()).toEqual([])
  })

  it('a video start sends no handshake to the old address', async () => {
    await standWithLive()
    made.hook = () => {
      origin = OTHER
    }
    const { timing } = fakeTiming()
    const v = comfyVideo(
      comfyContext(() => origin),
      { timing, checks: createServerChecks() },
    )
    const { remoteJobId } = await v.start(videoInput)
    await settle()
    expect(side.upgrades).toEqual([])
    expect(await v.check(remoteJobId)).toMatchObject({
      status: 'failed',
      error: { reason: 'address_changed' },
    })
    expect(linesAfterPrompt()).toEqual([])
  })
})

describe('the address changes while the live connection is open [CU-9b]', () => {
  const progress = textFrame({ type: 'progress', data: { value: 2, max: 4, prompt_id: PROMPT_ID } })

  it('a picture run closes it and passes on nothing more from it', async () => {
    await standWithLive()
    const seen: RunProgress[] = []
    const { timing } = fakeTiming(async (step) => {
      if (step !== 1) return
      await until(() => side.open() === 1)
      origin = OTHER
      side.send(progress)
      await until(() => side.open() === 0)
    })
    const provider = comfyImage(
      comfyContext(() => origin),
      { timing, checks: createServerChecks() },
    )
    const input = { prompt: 'p', references: [], width: 1080, height: 1080, count: 1 }
    await expect(provider.generate(input, { onProgress: (p) => seen.push(p) })).rejects.toThrow()
    expect(seen.some((p) => p.fraction !== undefined)).toBe(false)
    expect(linesAfterPrompt()).toEqual([])
  })

  it('a video run closes it and keeps no percent from it', async () => {
    await standWithLive()
    const { timing } = fakeTiming()
    const v = comfyVideo(
      comfyContext(() => origin),
      { timing, checks: createServerChecks() },
    )
    await v.start(videoInput)
    await until(() => side.open() === 1)
    origin = OTHER
    side.send(progress)
    await until(() => side.open() === 0)
    expect(linesAfterPrompt()).toEqual([])
  })
})
