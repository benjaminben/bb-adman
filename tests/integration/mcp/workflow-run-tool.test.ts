// CW-6a (spec/comfyui-custom.md "MCP tools"): generate_images with workflow_id runs that
// workflow on the ComfyUI stand-in. Nothing here contacts a real server.
import { afterEach, describe, expect, it } from 'vitest'
import { historyEntry, servePicture } from '../../helpers/comfy-run'
import { checked } from '../comfy-workflows/store-fixture'
import { prompts } from '../generation/custom-run-fixture'
import { replyJson } from './tool-client'
import {
  finishWhenSubmitted,
  imageArgs,
  jobReaches,
  runSetUp,
  startedId,
  type RunSetUp,
} from './run-tools-fixture'

let r: RunSetUp | undefined
afterEach(async () => {
  await r?.close()
  r = undefined
})

describe('generate_images with workflow_id [CW-6a]', () => {
  it('runs the named custom workflow, listed by list_comfy_workflows', async () => {
    r = await runSetUp()
    servePicture(r.stand)
    const id = r.f.core.deps.comfyWorkflows.add({
      checked: checked('picture'),
      name: 'Lighthouse',
      addedBy: 'user',
    }).stored.id
    const listed = replyJson<{ workflows: Array<{ id: string }> }>(
      await r.s.call('list_comfy_workflows', {}),
    )
    expect(listed.workflows.map((w) => w.id)).toContain(id)
    const reply = await r.s.call('generate_images', imageArgs(r, { workflow_id: id }))
    expect(reply.isError).toBeFalsy()
    const jobId = startedId(reply)
    expect(r.f.job(jobId)).toMatchObject({ startedBy: 'agent', request: { workflowId: id } })
    await finishWhenSubmitted(r, () => historyEntry('9'))
    expect((await jobReaches(r, jobId, ['succeeded', 'failed'])).status).toBe('succeeded')
    const sent = prompts(r.stand)[0]?.prompt ?? {}
    expect(sent['4']?.inputs.ckpt_name).toBe('made-up-model.safetensors')
  }, 25_000)
})
