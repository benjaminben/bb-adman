// CW-8 (spec/comfyui-custom.md "Security", rule 2): the marker proof. A graph with a marker in
// every text it holds goes through a person's add from a file, an agent's add allowed through
// the real permission broker, a refused add of each kind, the list (user, agent, MCP), a run, a
// failed run, a missing_items run and both removes. The marker is in no reply, event, log line,
// job row or file the app wrote; only the user-only replies the rule names may hold it.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { data } from '../core-fixture'
import { waitFor } from '../generation/generation-fixture'
import { replyJson } from '../mcp/tool-client'
import { historyEntry, servePicture, finishRun } from '../../helpers/comfy-run'
import { rememberWorkflowPath } from '@/main/providers/comfyui/custom/chosen-workflow-path'
import { MARKER, MARKED_OUTPUT, markedCanvas, markedGraph } from './marked-graph'
import { filesHolding, markerSetUp, type Marker } from './marker-fixture'

let x: Marker | undefined
afterEach(async () => {
  await x?.close()
  x = undefined
})

const GONE = `${MARKER}Gone`

const failedEntry = {
  status: {
    status_str: 'error',
    completed: false,
    messages: [['execution_error', { exception_type: 'RuntimeError', exception_message: 'x' }]],
  },
  outputs: {},
}

const posted = (s: Marker) =>
  s.stand.seen
    .filter((q) => q.method === 'POST' && q.path === '/prompt')
    .map((q) => JSON.parse(q.body.toString('utf8')) as { prompt_id: string })

async function finishNth(s: Marker, n: number, entry: unknown): Promise<void> {
  await waitFor(() => posted(s).length >= n, 15_000)
  const sent = posted(s)[n - 1]
  if (!sent) throw new Error('nothing submitted')
  finishRun(s.stand, sent.prompt_id, entry)
}

async function ended(s: Marker, reply: unknown) {
  const jobId = data<{ jobId: string }>(reply as never).jobId
  const row = () => s.jobRows().find((r) => r.id === jobId) as Record<string, unknown> | undefined
  await waitFor(() => ['succeeded', 'failed', 'cancelled'].includes(String(row()?.status)), 15_000)
  return row()
}

async function pickFile(s: Marker, name: string, text: string) {
  const file = path.join(s.outside, name)
  fs.writeFileSync(file, text)
  rememberWorkflowPath(file)
  return s.user('comfyWorkflow.addFromFile', { filePath: file })
}

describe('no graph text leaves the app [D-104, rule 2, CW-8]', () => {
  it('holds through both adds, refusals, the list, three runs and both removes', async () => {
    x = await markerSetUp()
    servePicture(x.stand)
    x.stand.reply(`GET /object_info/${GONE}`, { status: 404, json: { error: 'none' } })
    const replies: unknown[] = []
    const userOnly: unknown[] = []

    const added = await pickFile(x, 'harbour.json', markedGraph())
    replies.push(added)
    const personId = data<{ workflowId: string }>(added).workflowId
    replies.push(await pickFile(x, 'board.json', markedCanvas()))

    const t = await x.session()
    const pending = t.call('add_comfy_workflow', {
      name: 'Lighthouse',
      workflow_json: markedGraph({ extraClass: GONE }),
    })
    const asked = await x.nthAsk()
    const query = { requestId: asked.requestId }
    userOnly.push(await x.core.query('agent.askWorkflow', query, { actor: 'user' }))
    replies.push(await x.core.query('agent.askWorkflow', query, { actor: 'agent' }))
    data(await x.allow(asked.requestId))
    const agentAdd = await pending
    replies.push(agentAdd)
    const agentId = replyJson<{ workflowId: string }>(agentAdd).workflowId
    replies.push(
      await t.call('add_comfy_workflow', {
        name: 'Broken',
        workflow_json: markedGraph({ noOutput: true }),
      }),
    )
    replies.push(await t.call('add_comfy_workflow', { name: 'Board', workflow_json: markedCanvas() }))
    expect(x.asked()).toHaveLength(1)

    replies.push(await x.core.query('comfyWorkflow.list', {}, { actor: 'user' }))
    replies.push(await x.core.query('comfyWorkflow.list', {}, { actor: 'agent' }))
    replies.push(await t.call('list_comfy_workflows', {}))

    const good = await x.run(personId, 'user')
    replies.push(good)
    await finishNth(x, 1, historyEntry(MARKED_OUTPUT))
    expect(await ended(x, good)).toMatchObject({ status: 'succeeded' })
    const bad = await x.run(personId, 'agent')
    replies.push(bad)
    await finishNth(x, 2, failedEntry)
    expect(await ended(x, bad)).toMatchObject({ status: 'failed' })
    const missing = await x.run(agentId, 'agent')
    replies.push(missing)
    expect(await ended(x, missing)).toMatchObject({
      status: 'failed',
      errorReason: 'missing_items',
      result: { missing: [], missingCount: 1 },
    })
    expect(posted(x)).toHaveLength(2)

    userOnly.push(await x.user('comfy.check', {}))
    userOnly.push(await x.core.query('comfy.getInfo', {}, { actor: 'user' }))
    replies.push(await x.core.query('comfy.getInfo', {}, { actor: 'agent' }))
    for (const actor of ['user', 'agent'] as const) {
      replies.push(await x.core.query('job.list', { projectId: x.projectId }, { actor }))
    }

    // The stored graphs hold the marker, so the file scan below can find it.
    const kept = path.join(x.root, 'userData', 'comfy-workflows')
    const holding = filesHolding(x.root, MARKER)
    expect(holding).toHaveLength(2)
    expect(holding.every((f) => path.dirname(f) === kept)).toBe(true)

    replies.push(await x.user('comfyWorkflow.remove', { workflowId: personId }))
    const removing = t.call('remove_comfy_workflow', { workflow_id: agentId })
    data(await x.allow((await x.nthAsk(2)).requestId))
    replies.push(await removing)
    expect(x.core.deps.comfyWorkflows.list()).toEqual([])

    // The graph did reach the places the rule allows, so the marker is there to be found.
    expect(JSON.stringify(userOnly)).toContain(MARKER)
    expect(JSON.stringify(posted(x))).toContain(MARKER)

    const seen = JSON.stringify([replies, x.events, x.jobRows()]) + x.logs()
    expect(seen).not.toContain(MARKER)
    expect(filesHolding(x.root, MARKER)).toEqual([])
  }, 60_000)
})
