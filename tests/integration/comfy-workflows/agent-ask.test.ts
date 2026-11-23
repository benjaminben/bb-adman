// CW-6a (spec/comfyui-custom.md "The agent's ask", "Security" rules 2, 6 and 7): an agent's
// comfyWorkflow.add through the real permission broker. The text is checked before the ask; a
// good one asks with kind workflow and no node type in the event; agent.askWorkflow gives the
// four fields to the user only; no auto-approve, no "remember"; only "Add" saves.
import { afterEach, describe, expect, it, vi } from 'vitest'
import { data } from '../core-fixture'
import { askSetUp, askLines, type AskSetUp } from '../mcp/ask-fixture'
import { fixtureText, type CustomFixture } from '../../fixtures/comfy-custom/load'
import { checkWorkflowText } from '@/main/providers/comfyui/custom/check-file'
import { ASK_WAIT_MS } from '@/shared/config/agent-ask'

let x: AskSetUp | undefined
afterEach(async () => {
  vi.useRealTimers()
  await x?.close()
  x = undefined
})

const PICTURE_TYPES = [
  'CLIPTextEncode',
  'CheckpointLoaderSimple',
  'EmptyLatentImage',
  'KSampler',
  'PreviewImage',
  'VAEDecode',
]

const add = (s: AskSetUp, workflow: CustomFixture | string, extra: object = {}) =>
  s.agent('comfyWorkflow.add', {
    name: 'Harbour at dusk',
    workflowJson: workflow.startsWith('{') ? workflow : fixtureText(workflow as CustomFixture),
    ...extra,
  })

const answer = (s: AskSetUp, requestId: string, allow: boolean, rememberAuto = false) =>
  s.user('agent.answerPermission', { requestId, allow, rememberAuto })

const askWorkflow = (s: AskSetUp, requestId: string, actor: 'user' | 'agent' = 'user') =>
  s.core.query('agent.askWorkflow', { requestId }, { actor })

const saved = (s: AskSetUp) => s.core.deps.comfyWorkflows.list()

describe('comfyWorkflow.add is checked before the ask [CW-6a; rule 2]', () => {
  it('refuses a canvas file with the fixed sentence and sends no event', async () => {
    x = await askSetUp()
    const canvas = fixtureText('canvas')
    const expected = checkWorkflowText(canvas)
    if (expected.ok) throw new Error('the canvas fixture passed the checks')
    const reply = await add(x, canvas)
    expect(reply).toEqual({ ok: false, error: expected.error })
    expect(x.asked()).toEqual([])
    expect(saved(x)).toEqual([])
  })

  it('refuses video values for a picture graph, and a name that cleans to nothing, with no event', async () => {
    x = await askSetUp()
    const video = { fps: 16, maxMs: 4_000, frameStep: 8, frameOffset: 1 }
    expect(await add(x, 'picture', { video })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    const blank = String.fromCharCode(0x202e, 0x200b, 32)
    expect(await add(x, 'picture', { name: blank })).toMatchObject({
      ok: false,
      error: { code: 'INVALID_INPUT' },
    })
    expect(x.asked()).toEqual([])
    expect(saved(x)).toEqual([])
  })
})

describe('the workflow ask [CW-6a; rules 6 and 7]', () => {
  it('asks with kind workflow, fileCount 0 and the target line, and no node type', async () => {
    x = await askSetUp()
    const pending = add(x, 'picture')
    const asked = await x.nthAsk()
    expect(Object.keys(asked).sort()).toEqual(
      ['action', 'agentClient', 'expiresAt', 'fileCount', 'kind', 'requestId', 'target'].sort(),
    )
    expect(asked).toMatchObject({
      action: 'add ComfyUI workflows',
      kind: 'workflow',
      fileCount: 0,
      target: 'Workflow "Harbour at dusk": Picture from a prompt, 6 node types',
    })
    const sent = JSON.stringify(x.events)
    for (const type of PICTURE_TYPES) expect(sent.includes(type), type).toBe(false)
    expect(sent.includes('made-up-model')).toBe(false)
    data(await answer(x, asked.requestId, false))
    await pending
  })

  it('gives the user the four fields, refuses the agent, and ends with the ask', async () => {
    x = await askSetUp()
    const pending = add(x, 'picture')
    const asked = await x.nthAsk()
    expect(data(await askWorkflow(x, asked.requestId))).toEqual({
      name: 'Harbour at dusk',
      job: 'image',
      start: null,
      nodeTypes: PICTURE_TYPES,
    })
    expect(await askWorkflow(x, asked.requestId, 'agent')).toMatchObject({
      ok: false,
      error: { code: 'AGENT_DENIED' },
    })
    expect(await askWorkflow(x, 'made-up-request')).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That request has ended.' },
    })
    data(await answer(x, asked.requestId, true))
    const reply = await pending
    const { workflowId } = data<{ workflowId: string }>(reply)
    expect(Object.keys(data<object>(reply))).toEqual(['workflowId'])
    expect(saved(x).map((e) => [e.stored.id, e.stored.name, e.stored.addedBy])).toEqual([
      [workflowId, 'Harbour at dusk', 'agent'],
    ])
    expect(await askWorkflow(x, asked.requestId)).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That request has ended.' },
    })
  })

  it('names the job, the start and the reference count in the target line', async () => {
    x = await askSetUp()
    const cases: Array<[CustomFixture, string, unknown]> = [
      ['two-refs', 'Picture from a prompt and 2 reference pictures', null],
      ['video-first-frame', 'Video from a first frame', 'first_frame'],
      ['video-prompt', 'Video from a prompt', 'prompt'],
    ]
    for (const [i, [fixture, words, start]] of cases.entries()) {
      const pending = add(x, fixture)
      const asked = await x.nthAsk(i + 1)
      expect(asked.target).toMatch(new RegExp(`^Workflow "Harbour at dusk": ${words}, \\d+ node types$`))
      expect(data(await askWorkflow(x, asked.requestId))).toMatchObject({ start })
      data(await answer(x, asked.requestId, false))
      await pending
    }
  })

  it('shows the cleaned name', async () => {
    x = await askSetUp()
    const name = `  "Harbour"${String.fromCharCode(0x202e)}  at   dusk `
    const pending = add(x, 'picture', { name })
    const asked = await x.nthAsk()
    const view = data<{ name: string }>(await askWorkflow(x, asked.requestId))
    expect(asked.target.startsWith(`Workflow "${view.name}": `)).toBe(true)
    expect(view.name.includes(String.fromCharCode(0x202e))).toBe(false)
    expect(view.name).not.toBe(name)
    data(await answer(x, asked.requestId, false))
    await pending
  })
})

describe('only the person answers a workflow ask [CW-6a; rule 6]', () => {
  it('still asks with mcp.autoApproveDestructive on; refuse saves nothing', async () => {
    x = await askSetUp()
    data(await x.user('settings.update', { mcp: { autoApproveDestructive: true } }))
    const pending = add(x, 'picture')
    const asked = await x.nthAsk()
    expect(asked.kind).toBe('workflow')
    data(await answer(x, asked.requestId, false))
    expect(await pending).toMatchObject({ ok: false, error: { code: 'AGENT_REFUSED' } })
    expect(saved(x)).toEqual([])
    expect(askLines(x.readLogs()).map((l) => l.message)).toEqual(['refused'])
    expect(await askWorkflow(x, asked.requestId)).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'That request has ended.' },
    })
  })

  it('ignores "remember": the setting stays off and the next add asks again', async () => {
    x = await askSetUp()
    const first = add(x, 'picture')
    const asked = await x.nthAsk()
    data(await answer(x, asked.requestId, true, true))
    data(await first)
    expect(x.core.settings.get().mcp.autoApproveDestructive).toBe(false)
    const second = add(x, 'two-refs', { name: 'Two pictures' })
    const again = await x.nthAsk(2)
    expect(again.kind).toBe('workflow')
    data(await answer(x, again.requestId, false))
    expect(await second).toMatchObject({ ok: false, error: { code: 'AGENT_REFUSED' } })
    expect(saved(x)).toHaveLength(1)
  })

  it('times out at two minutes with AGENT_REFUSED, saves nothing and ends the view', async () => {
    x = await askSetUp()
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] })
    const pending = add(x, 'picture')
    const asked = await x.nthAsk()
    vi.advanceTimersByTime(ASK_WAIT_MS)
    expect(await pending).toMatchObject({
      ok: false,
      error: { code: 'AGENT_REFUSED', details: { reason: 'timed_out' } },
    })
    expect(saved(x)).toEqual([])
    expect(await askWorkflow(x, asked.requestId)).toMatchObject({
      ok: false,
      error: { code: 'NOT_FOUND' },
    })
  })

  it('writes no graph text and no name into the ask log line', async () => {
    x = await askSetUp()
    const pending = add(x, 'picture')
    const asked = await x.nthAsk()
    data(await answer(x, asked.requestId, true))
    data(await pending)
    const logs = x.readLogs()
    for (const text of [...PICTURE_TYPES, 'Harbour', 'made-up-model', 'lighthouse']) {
      expect(logs.includes(text), text).toBe(false)
    }
  })
})
