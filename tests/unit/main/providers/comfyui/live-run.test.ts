// CU-9 [REQ: FR-269]: a picture run watches its own prompt on the live connection while it
// polls, passes on what changed, and stops listening when it ends in any way. The run never
// waits on the live connection: with nothing heard, polling finishes it.
import { afterEach, describe, expect, it } from 'vitest'
import { startComfyStandIn, type StandIn } from '../../../../helpers/comfy-stand-in'
import {
  PROMPT_ID,
  fakeTiming,
  finishRun,
  historyEntry,
  servePicture,
} from '../../../../helpers/comfy-run'
import { createComfyClient } from '@/main/providers/comfyui/client'
import type { LiveSeen } from '@/main/providers/comfyui/live-messages'
import { runPicture, type RunEnv } from '@/main/providers/comfyui/run'
import { mossTextToImage as moss } from '@/main/providers/comfyui/workflows/moss'
import { ProviderCancelled, type RunProgress } from '@/main/providers/types'

let stand: StandIn
afterEach(async () => {
  await stand.close()
})

type Hear = (seen: Exclude<LiveSeen, 'ended'>) => void
const ask = { prompt: 'p', width: 1080, height: 1080, references: [] }

// A live link that records the watched ID and hands the test what the run would hear.
function fakeLive() {
  const state = { watched: [] as string[], hear: null as Hear | null, stops: 0 }
  const live: RunEnv['live'] = {
    watch: (promptId, onSeen) => {
      state.watched.push(promptId)
      state.hear = onSeen
      return () => (state.stops += 1)
    },
  }
  return { live, state }
}

async function run(
  onSleep: (step: number, hear: Hear) => void,
  ending = historyEntry(moss.slots.outputNode),
) {
  stand = await startComfyStandIn()
  servePicture(stand)
  const { live, state } = fakeLive()
  const { timing } = fakeTiming((step) => {
    if (state.hear) onSleep(step, state.hear)
    if (step === 4) finishRun(stand, PROMPT_ID, ending)
  })
  const client = createComfyClient({ origin: stand.origin, ownPorts: () => [] })
  const progress: RunProgress[] = []
  const env: RunEnv = { client, timing, serverVersion: '0.45.0', live }
  const outcome = runPicture(env, moss, ask, { onProgress: (p) => progress.push(p) })
  return {
    outcome: await outcome.then(
      () => 'ok',
      () => 'failed',
    ),
    state,
    progress,
  }
}

describe('a picture run with a live connection [CU-9]', () => {
  it('passes on the live percent once per whole percent, and stops listening at the end', async () => {
    const { outcome, state, progress } = await run((step, hear) => {
      if (step === 2) hear({ stage: 'working', fraction: 0.5 })
      if (step === 3) hear({ stage: 'working', fraction: 0.5 })
      if (step === 3) hear({ stage: 'working', fraction: 0.75 })
    })
    expect(outcome).toBe('ok')
    expect(state.watched).toEqual([PROMPT_ID])
    // The stand-in's job route says pending first; the live connection then says working.
    expect(progress).toEqual([
      { stage: 'waiting' },
      { stage: 'working', fraction: 0.5 },
      { stage: 'working', fraction: 0.75 },
    ])
    expect(state.stops).toBe(1)
  })

  it('finishes by polling when the live connection hears nothing', async () => {
    const { outcome, progress, state } = await run(() => undefined)
    expect(outcome).toBe('ok')
    expect(progress).toEqual([{ stage: 'waiting' }])
    expect(state.stops).toBe(1)
  })

  it('stops listening when the run fails', async () => {
    const failedEntry = {
      status: { status_str: 'error', completed: false, messages: [] },
      outputs: {},
    }
    const { outcome, state } = await run(() => undefined, failedEntry)
    expect(outcome).toBe('failed')
    expect(state.stops).toBe(1)
  })

  it('stops listening when the run is cancelled', async () => {
    stand = await startComfyStandIn()
    stand.reply(`GET /api/jobs/${PROMPT_ID}`, { status: 404, json: {} })
    stand.reply('GET /queue', { json: { queue_running: [], queue_pending: [[1, PROMPT_ID]] } })
    const { live, state } = fakeLive()
    const controller = new AbortController()
    const { timing } = fakeTiming(() => controller.abort())
    const client = createComfyClient({ origin: stand.origin, ownPorts: () => [] })
    const env: RunEnv = { client, timing, serverVersion: '0.45.0', live }
    const outcome = runPicture(env, moss, ask, { signal: controller.signal })
    await expect(outcome).rejects.toBeInstanceOf(ProviderCancelled)
    expect(state.stops).toBe(1)
  })
})
