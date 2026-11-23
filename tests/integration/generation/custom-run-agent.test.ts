// CW-3: an agent's run of a custom workflow (spec/comfyui-custom.md "Which workflow a run
// gets" and "Security", rules 2 and 7; spec/agent-runs.md "Gate steps for a run").
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { historyEntry, servePicture } from '../../helpers/comfy-run'
import { checkWorkflowText } from '@/main/providers/comfyui/custom/check-file'
import { fixtureText } from '../../fixtures/comfy-custom/load'
import { readWireRows } from '@/main/db/rows'
import {
  customRunSetUp,
  finishSubmitted,
  jobEnds,
  prompts,
  type CustomRun,
} from './custom-run-fixture'

let r: CustomRun
afterEach(() => r.close())

type Reply = { ok: boolean; data?: { jobId: string }; error?: { code: string; message: string } }

const MARKER = 'QX7MARKER'

// The picture fixture with the marker in a node ID, a class name, an input name, an input
// value and a title, so it still passes the checks.
function addMarked(): string {
  const graph = JSON.parse(fixtureText('picture')) as Record<string, unknown>
  graph[`${MARKER}-node`] = {
    class_type: `${MARKER}Class`,
    inputs: { [`${MARKER}_input`]: `${MARKER} value`, images: ['8', 0] },
    _meta: { title: `${MARKER} title` },
  }
  const result = checkWorkflowText(JSON.stringify(graph))
  if (!result.ok) throw new Error('the marked graph failed the checks')
  const store = r.f.core.deps.comfyWorkflows
  return store.add({ checked: result.data, name: 'Harbour', addedBy: 'agent' }).stored.id
}

const tick = (allowed: boolean) =>
  r.f.user('agentRuns.setAllowed', { provider: 'comfyui', allowed })

function logText(): string {
  const dir = path.join(r.f.root, 'userData', 'logs')
  if (!fs.existsSync(dir)) return ''
  return fs
    .readdirSync(dir)
    .map((n) => fs.readFileSync(path.join(dir, n), 'utf8'))
    .join('')
}

const failedEntry = {
  status: {
    status_str: 'error',
    completed: false,
    messages: [['execution_error', { exception_type: 'RuntimeError', exception_message: 'x' }]],
  },
  outputs: {},
}

describe('an agent names a custom workflow [D-104, CW-3]', () => {
  it('with the tick on is accepted, and the run sends that workflow', async () => {
    r = await customRunSetUp()
    servePicture(r.stand)
    await tick(true)
    const id = addMarked()
    const reply = (await r.f.run({ workflowId: id }, 'agent')) as Reply
    expect(reply.ok).toBe(true)
    const jobId = reply.data?.jobId ?? ''
    expect(r.f.job(jobId)).toMatchObject({ startedBy: 'agent', request: { workflowId: id } })
    await finishSubmitted(r.stand, () => historyEntry('9'))
    expect((await jobEnds(r.f, jobId))?.status).toBe('succeeded')
    expect(prompts(r.stand)[0]?.prompt).toHaveProperty(`${MARKER}-node`)
  }, 25_000)

  it('with the tick off is AGENT_DENIED, with no job row and nothing sent', async () => {
    r = await customRunSetUp()
    const id = addMarked()
    for (const name of ['generation.runImages', 'generation.startVideo'] as const) {
      const input =
        name === 'generation.runImages'
          ? { variantId: 'v1', slot: 'background', prompt: 'p', referenceAssetIds: [], count: 1 }
          : {
              variantId: 'v1',
              prompt: 'p',
              durationMs: 2_000,
              start: 'none',
              useReferences: false,
              referenceAssetIds: [],
            }
      const reply = (await r.f.agent(name, {
        ...input,
        provider: 'comfyui',
        workflowId: id,
      })) as Reply
      expect(reply).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    }
    expect(r.f.jobs()).toEqual([])
    expect(r.stand.seen).toEqual([])
  })

  it('leaves no graph text and no address in a reply, a job row, a log line or an event', async () => {
    r = await customRunSetUp()
    await tick(true)
    const id = addMarked()
    const replies: unknown[] = []
    const good = (await r.f.run({ workflowId: id }, 'agent')) as Reply
    replies.push(good)
    await finishSubmitted(r.stand, () => failedEntry)
    await jobEnds(r.f, good.data?.jobId ?? '')
    replies.push(await r.f.run({ workflowId: id, referenceAssetIds: ['a1'] }, 'agent'))
    replies.push(await r.f.run({ workflowId: 'custom-ffffffffffff' }, 'agent'))
    replies.push(await r.f.core.query('comfyWorkflow.list', {}, { actor: 'agent' }))
    const rows = readWireRows(r.f.db, 'job')
    const seen = JSON.stringify([replies, rows, r.f.events]) + logText()
    expect(seen).not.toContain(MARKER)
    expect(seen).not.toContain(r.stand.origin)
    expect(seen).not.toContain(`127.0.0.1:${r.stand.port}`)
  }, 25_000)

  it('a missing_items failure leaves no node type in a reply, a job row, a log line or an event [CW-7]', async () => {
    r = await customRunSetUp()
    await tick(true)
    const id = addMarked()
    r.stand.reply(`GET /object_info/${MARKER}Class`, { status: 404, json: { error: 'none' } })
    const reply = (await r.f.run({ workflowId: id }, 'agent')) as Reply
    const job = await jobEnds(r.f, reply.data?.jobId ?? '')
    expect(job).toMatchObject({
      status: 'failed',
      errorReason: 'missing_items',
      result: { missing: [], missingCount: 1 },
    })
    expect(prompts(r.stand)).toEqual([])
    const read = await r.f.core.query('job.list', { projectId: r.f.projectId }, { actor: 'agent' })
    const rows = readWireRows(r.f.db, 'job')
    const seen = JSON.stringify([reply, read, rows, r.f.events]) + logText()
    expect(seen).not.toContain(MARKER)
  }, 25_000)
})
