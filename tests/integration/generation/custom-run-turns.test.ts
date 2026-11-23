// CW-3: job.retry of a custom run, and a queued custom run whose workflow is removed before
// its turn, through the real core against the stand-in (spec/comfyui-custom.md "Which
// workflow a run gets").
import { describe, it, expect, afterEach } from 'vitest'
import { greyPng } from '@/main/providers/fake/png'
import { JOBS_AT_ONCE_PER_PROVIDER } from '@/shared/config/job-kinds'
import { mossTextToImage as moss } from '@/main/providers/comfyui/workflows/moss'
import { historyEntry, servePicture } from '../../helpers/comfy-run'
import { waitFor } from './generation-fixture'
import {
  addCustom,
  changedInputs,
  customRunSetUp,
  finishSubmitted,
  jobEnds,
  prompts,
  RUN_MS,
  storedGraph,
  uploads,
  type CustomRun,
} from './custom-run-fixture'

let r: CustomRun
afterEach(() => r.close())

type Reply = { ok: boolean; data?: { jobId: string }; error?: { code: string; details?: unknown } }

const failedEntry = {
  status: {
    status_str: 'error',
    completed: false,
    messages: [['execution_error', { exception_type: 'RuntimeError', exception_message: 'x' }]],
  },
  outputs: {},
}

const started = (reply: unknown) => {
  const r = reply as Reply
  expect(r.error).toBeUndefined()
  return r.data?.jobId ?? ''
}

describe('job.retry of a custom run [D-104, CW-3]', () => {
  it('runs the stored workflow again, and the new row names it', async () => {
    r = await customRunSetUp()
    servePicture(r.stand)
    const id = addCustom(r, 'picture', 'Lighthouse')
    const first = started(await r.f.run({ workflowId: id }))
    await finishSubmitted(r.stand, () => failedEntry)
    expect((await jobEnds(r.f, first))?.status).toBe('failed')

    const again = started(await r.f.user('job.retry', { jobId: first }))
    expect(r.f.job(again)?.request).toMatchObject({ workflowId: id })
    await finishSubmitted(r.stand, () => historyEntry('9'), 2)
    expect((await jobEnds(r.f, again))?.status).toBe('succeeded')
    const sent = prompts(r.stand)[1]?.prompt ?? {}
    expect(changedInputs(storedGraph(r, id), sent)).toEqual(
      ['3.seed', '5.height', '5.width', '6.text'].sort(),
    )
  }, 30_000)

  it('refuses a retry whose workflow was removed: comfy_workflow_not_found, no job', async () => {
    r = await customRunSetUp()
    const id = addCustom(r, 'picture', 'Lighthouse')
    const first = started(await r.f.run({ workflowId: id }))
    await finishSubmitted(r.stand, () => failedEntry)
    await jobEnds(r.f, first)
    r.f.core.deps.comfyWorkflows.remove(id)
    const seen = r.stand.seen.length
    const reply = (await r.f.user('job.retry', { jobId: first })) as Reply
    expect(reply).toMatchObject({
      ok: false,
      error: { code: 'RULE_VIOLATION', details: { reason: 'comfy_workflow_not_found' } },
    })
    expect(r.f.jobs()).toHaveLength(1)
    expect(r.stand.seen.length).toBe(seen)
  }, 30_000)
})

describe('a custom run whose workflow is removed before its turn [D-104, CW-3]', () => {
  it('ends failed with reason workflow_gone, and nothing of it is sent', async () => {
    r = await customRunSetUp()
    servePicture(r.stand)
    const id = addCustom(r, 'two-refs', 'Two bottles')
    const a = await r.f.importPicture('in', 'a.png')
    const b = await r.f.importPicture('in', 'b.png', greyPng(7, 4))
    // The runner's places for ComfyUI are taken by shipped runs the stand-in holds.
    const holders: string[] = []
    for (let i = 0; i < JOBS_AT_ONCE_PER_PROVIDER; i++) holders.push(started(await r.f.run({})))
    await waitFor(() => prompts(r.stand).length === JOBS_AT_ONCE_PER_PROVIDER, RUN_MS)
    const custom = started(await r.f.run({ workflowId: id, referenceAssetIds: [a, b] }))
    expect(r.f.job(custom)?.status).toBe('queued')
    expect(r.f.core.deps.comfyWorkflows.remove(id)).toBe(true)

    for (let n = 1; n <= JOBS_AT_ONCE_PER_PROVIDER; n++) {
      await finishSubmitted(r.stand, () => historyEntry(moss.slots.outputNode), n)
    }
    const job = await jobEnds(r.f, custom)
    expect(job).toMatchObject({
      status: 'failed',
      errorKind: 'other',
      errorReason: 'workflow_gone',
    })
    for (const holder of holders) expect(r.f.job(holder)?.status).toBe('succeeded')
    expect(prompts(r.stand)).toHaveLength(JOBS_AT_ONCE_PER_PROVIDER)
    expect(uploads(r.stand)).toEqual([])
  }, 40_000)
})
