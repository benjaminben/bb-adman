// MCP-G (security class): generate_images and generate_video over the real HTTP door, the
// real core and the ComfyUI stand-in, with dev tools on and ComfyUI ticked by the user
// (spec/phases/phase-02-agent-generation.md "MCP-G", spec/agent-runs.md "Tests that must
// exist"). The adapter and the job poll on their real 2 s clocks.
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { replyJson } from './tool-client'
import {
  finishWhenSubmitted,
  imageArgs,
  jobReaches,
  NOT_TICKED,
  runSetUp,
  startedId,
  type RunSetUp,
} from './run-tools-fixture'
import { historyEntry, servePicture, serveVideo, videoHistoryEntry } from '../../helpers/comfy-run'
import { greyPng } from '@/main/providers/fake/png'
import { uploadName } from '@/main/providers/comfyui/values'
import { mossTextToImage as moss } from '@/main/providers/comfyui/workflows/moss'
import { h3ImageToVideo } from '@/main/providers/comfyui/workflows/h3'
import { fitSize } from '@/shared/comfy/fit-size'

let r: RunSetUp | undefined
afterEach(async () => {
  await r?.close()
  r = undefined
})

type Refusal = { code: string; message: string; details?: Record<string, unknown> }
type Slot = { slotId: string; type: string }

const RUN_SIZE = fitSize({ width: 1080, height: 1350 }, h3ImageToVideo.size)
const FITTED = greyPng(RUN_SIZE.width, RUN_SIZE.height)

describe('generate_images [MCP-G; FR-062, FR-279, D-080]', () => {
  it('with a slot from get_slots gives a jobId, and get_job later shows succeeded with new asset IDs', async () => {
    r = await runSetUp()
    servePicture(r.stand)
    const slots = replyJson<Slot[]>(
      await r.s.call('get_slots', { project_id: r.projectId, campaign_id: 'c1' }),
    )
    const slot = slots.find((x) => x.type === 'image')?.slotId
    expect(slot).toBeTruthy()
    const reply = await r.s.call('generate_images', imageArgs(r, { slot }))
    expect(reply.isError).toBeFalsy()
    expect(Object.keys(replyJson(reply))).toEqual(['jobId'])
    const jobId = startedId(reply)
    expect(r.f.job(jobId)).toMatchObject({ startedBy: 'agent', seenAt: null, slot })
    await finishWhenSubmitted(r, () => historyEntry(moss.slots.outputNode))
    const view = await jobReaches(r, jobId, ['succeeded', 'failed'])
    expect(view.status).toBe('succeeded')
    expect(view.assetIds).toHaveLength(1)
    expect(r.f.asset(view.assetIds[0] ?? '')).toMatchObject({ kind: 'image' })
  }, 25_000)

  it('with the tick off: AGENT_DENIED with the step 2 sentence, no job row, the stand-in saw nothing', async () => {
    r = await runSetUp({ ticked: false })
    const before = r.stand.seen.length
    const reply = await r.s.call('generate_images', imageArgs(r))
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toEqual({ code: 'AGENT_DENIED', message: NOT_TICKED })
    expect(r.f.jobs()).toEqual([])
    expect(r.stand.seen.length).toBe(before)
  })

  // The limit sentence is being reworded in AR-2, so its words are not pinned here.
  it('two calls together with limit 1: one jobId and one refusal at gate step 3', async () => {
    r = await runSetUp()
    data(await r.f.core.bus.execute('agentRuns.setLimit', { limit: 1 }, { actor: 'user' }))
    const replies = await Promise.all([
      r.s.call('generate_images', imageArgs(r)),
      r.s.call('generate_images', imageArgs(r)),
    ])
    const started = replies.filter((x) => !x.isError)
    const refused = replies.filter((x) => x.isError).map((x) => replyJson<Refusal>(x))
    expect(started).toHaveLength(1)
    expect(refused).toHaveLength(1)
    expect(refused[0]?.code).toBe('AGENT_DENIED')
    expect(refused[0]?.message).not.toBe(NOT_TICKED)
    expect(r.f.jobs()).toHaveLength(1)
  })
})

describe('generate_video [MCP-G; FR-262, FR-279, D-080]', () => {
  it('from a first frame named by asset ID: one upload under uploadName, and get_job shows the clip', async () => {
    r = await runSetUp({ fitPicture: () => FITTED })
    serveVideo(r.stand)
    const picture = await r.f.importPicture('Private Shoots', 'secret-shoe.png', greyPng(12, 16))
    const reply = await r.s.call('generate_video', {
      project_id: r.projectId,
      variant_id: 'v1',
      prompt: 'A bottle on a rock',
      duration_ms: 2_000,
      provider: 'comfyui',
      start: 'first_frame',
      use_references: false,
      reference_asset_ids: [picture],
    })
    expect(reply.isError).toBeFalsy()
    expect(Object.keys(replyJson(reply))).toEqual(['jobId'])
    const jobId = startedId(reply)
    await finishWhenSubmitted(r, (id) => videoHistoryEntry(h3ImageToVideo.slots.outputNode, id))
    const uploads = r.stand.seen.filter((q) => q.path === '/upload/image')
    expect(uploads).toHaveLength(1)
    expect(uploads[0]?.body.toString('latin1')).toContain(`filename="${uploadName(FITTED)}"`)
    const view = await jobReaches(r, jobId, ['succeeded', 'failed'])
    expect(view.status).toBe('succeeded')
    expect(view.assetIds).toHaveLength(1)
    expect(r.f.asset(view.assetIds[0] ?? '')).toMatchObject({ kind: 'video' })
    expect(r.f.job(jobId)).toMatchObject({ startedBy: 'agent', seenAt: null })
  }, 25_000)
})
