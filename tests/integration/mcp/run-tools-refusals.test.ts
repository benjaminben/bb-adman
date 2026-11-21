// MCP-G (security class): cancel_job, and the replies for reference pictures that cannot be
// sent, over the real HTTP door, the real core and the ComfyUI stand-in (spec/phases/
// phase-02-agent-generation.md "MCP-G"; spec/agent-runs.md "job.cancel for an agent").
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { data } from '../core-fixture'
import { replyJson } from './tool-client'
import { imageArgs, jobReaches, runSetUp, startedId, type RunSetUp } from './run-tools-fixture'
import { waitFor } from '../generation/generation-fixture'
import { MAX_PICTURE_BYTES } from '@/main/providers/picture-limits'

let r: RunSetUp | undefined
afterEach(async () => {
  await r?.close()
  r = undefined
})

const OWN_ONLY = 'Agents can cancel only runs they started.'

describe('cancel_job [MCP-G; FR-281]', () => {
  it('cancels a running run an agent started: it ends cancelled', async () => {
    r = await runSetUp()
    const jobId = startedId(await r.s.call('generate_images', imageArgs(r)))
    const sent = () => r?.stand.seen.find((q) => q.path === '/prompt')
    await waitFor(() => sent() !== undefined, 15_000)
    expect(r.f.job(jobId)?.status).toBe('running')
    // The stand-in holds the run in its queue, so the app's own-ID cancel can remove it.
    const { prompt_id: promptId } = JSON.parse(sent()?.body.toString('utf8') ?? '{}') as {
      prompt_id: string
    }
    r.stand.reply('GET /queue', { json: { queue_running: [], queue_pending: [[1, promptId]] } })
    const reply = await r.s.call('cancel_job', { project_id: r.projectId, job_id: jobId })
    expect(reply.isError).toBeFalsy()
    expect(replyJson(reply)).toEqual({ jobId })
    expect((await jobReaches(r, jobId, ['cancelled', 'succeeded', 'failed'])).status).toBe(
      'cancelled',
    )
  }, 25_000)

  it('refuses a run the user started, and the run goes on', async () => {
    r = await runSetUp()
    const { jobId } = data<{ jobId: string }>(await r.f.run({}))
    const reply = await r.s.call('cancel_job', { project_id: r.projectId, job_id: jobId })
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toEqual({ code: 'AGENT_DENIED', message: OWN_ONLY })
    expect(['queued', 'running']).toContain(r.f.job(jobId)?.status)
  })
})

// The display name is not the file name, so a reply that holds the file name is caught.
async function reference(x: RunSetUp, displayName: string): Promise<{ id: string; file: string }> {
  const id = await x.f.importPicture('Private Shoots', 'secret-shoe.png')
  data(await x.f.user('asset.update', { assetId: id, displayName }))
  return { id, file: path.join(x.f.root, 'Private Shoots', 'secret-shoe.png') }
}

describe('a reference picture that cannot be sent [MCP-G; FR-198]', () => {
  it.each([
    [
      'whose linked file is gone',
      (file: string) => fs.rmSync(file),
      (id: string) => ({ code: 'MISSING_FILE', details: { assetIds: [id] } }),
    ],
    [
      'over the size limit',
      (file: string) => fs.truncateSync(file, MAX_PICTURE_BYTES + 1),
      () => ({ code: 'RULE_VIOLATION', details: { reason: 'asset_too_large' } }),
    ],
  ])(
    '%s: the reply holds the display name or ID, never a folder or file name',
    async (_, spoil, want) => {
      r = await runSetUp()
      const { id, file } = await reference(r, 'Beach shot')
      spoil(file)
      const reply = await r.s.call('generate_images', imageArgs(r, { reference_asset_ids: [id] }))
      expect(reply.isError).toBe(true)
      const refusal = replyJson<{ message: string }>(reply)
      expect(refusal).toMatchObject(want(id))
      const text = JSON.stringify(reply)
      expect(text.includes(id) || refusal.message.includes('Beach shot')).toBe(true)
      for (const hidden of [r.f.root, 'Private Shoots', 'secret-shoe']) {
        expect(text, hidden).not.toContain(hidden)
      }
      expect(r.f.jobs()).toEqual([])
    },
  )
})
