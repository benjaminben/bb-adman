// CW-6a (spec/comfyui-custom.md "MCP tools", "Security" rules 2, 6 and 7): the three workflow
// tools over the real core, the real permission broker and the MCP door. list gives five
// fields per workflow; add asks every time and replies the new ID only; remove asks as a delete.
import { afterEach, describe, expect, it } from 'vitest'
import { data } from '../core-fixture'
import { askSetUp, riskyKeys, type AskSetUp } from './ask-fixture'
import { replyJson } from './tool-client'
import { fixtureText } from '../../fixtures/comfy-custom/load'
import { checkWorkflowText } from '@/main/providers/comfyui/custom/check-file'

let x: AskSetUp | undefined
afterEach(async () => {
  await x?.close()
  x = undefined
})

const MARKER = 'QX7MARKER'

// The picture fixture with the marker in a node ID, a class name, an input and a title.
function markedGraph(): string {
  const graph = JSON.parse(fixtureText('picture')) as Record<string, unknown>
  graph[`${MARKER}-node`] = {
    class_type: `${MARKER}Class`,
    inputs: { [`${MARKER}_input`]: `${MARKER} value`, images: ['8', 0] },
    _meta: { title: `${MARKER} title` },
  }
  return JSON.stringify(graph)
}

const answer = (s: AskSetUp, requestId: string, allow: boolean) =>
  s.user('agent.answerPermission', { requestId, allow, rememberAuto: false })

describe('list_comfy_workflows [CW-6a; rule 7]', () => {
  it('gives id, name, job, start and isDefault for each, and nothing else', async () => {
    x = await askSetUp()
    const checked = checkWorkflowText(markedGraph())
    if (!checked.ok) throw new Error('the marked graph failed the checks')
    const id = x.core.deps.comfyWorkflows.add({
      checked: checked.data,
      name: 'Harbour',
      addedBy: 'user',
    }).stored.id
    const t = await x.session()
    const reply = await t.call('list_comfy_workflows', {})
    expect(reply.isError).toBeFalsy()
    const listed = replyJson<{ workflows: Array<Record<string, unknown>> }>(reply)
    expect(Object.keys(listed)).toEqual(['workflows'])
    for (const w of listed.workflows) {
      expect(Object.keys(w).sort()).toEqual(['id', 'isDefault', 'job', 'name', 'start'])
    }
    expect(listed.workflows).toContainEqual({
      id,
      name: 'Harbour',
      job: 'image',
      start: null,
      isDefault: false,
    })
    const text = JSON.stringify(reply)
    expect(text.includes(MARKER)).toBe(false)
    expect(riskyKeys(listed)).toEqual([])
  })
})

describe('add_comfy_workflow [CW-6a; rules 2 and 6]', () => {
  it('refuses a canvas file with the fixed sentence and no dialog event', async () => {
    x = await askSetUp()
    const canvas = fixtureText('canvas')
    const expected = checkWorkflowText(canvas)
    if (expected.ok) throw new Error('the canvas fixture passed the checks')
    const t = await x.session()
    const reply = await t.call('add_comfy_workflow', { name: 'Board', workflow_json: canvas })
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toEqual(expected.error)
    expect(x.asked()).toEqual([])
    expect(x.core.deps.comfyWorkflows.list()).toEqual([])
  })

  it('asks, and on allow saves the workflow and replies exactly { workflowId }', async () => {
    x = await askSetUp()
    const t = await x.session()
    const pending = t.call('add_comfy_workflow', {
      name: 'Harbour',
      workflow_json: markedGraph(),
    })
    const asked = await x.nthAsk()
    expect(asked).toMatchObject({ kind: 'workflow', fileCount: 0 })
    expect(asked.target).toBe('Workflow "Harbour": Picture from a prompt, 7 node types')
    data(await answer(x, asked.requestId, true))
    const reply = await pending
    expect(reply.isError).toBeFalsy()
    const body = replyJson<Record<string, unknown>>(reply)
    expect(Object.keys(body)).toEqual(['workflowId'])
    const [entry] = x.core.deps.comfyWorkflows.list()
    expect(body.workflowId).toBe(entry?.stored.id)
    expect(entry?.stored.addedBy).toBe('agent')
    for (const where of [JSON.stringify(reply), JSON.stringify(x.events), x.readLogs()]) {
      expect(where.includes(MARKER)).toBe(false)
    }
  })

  it('refuse gives AGENT_REFUSED and saves nothing', async () => {
    x = await askSetUp()
    const t = await x.session()
    const pending = t.call('add_comfy_workflow', {
      name: 'Harbour',
      workflow_json: fixtureText('picture'),
    })
    data(await answer(x, (await x.nthAsk()).requestId, false))
    const reply = await pending
    expect(reply.isError).toBe(true)
    expect(replyJson(reply)).toMatchObject({ code: 'AGENT_REFUSED' })
    expect(x.core.deps.comfyWorkflows.list()).toEqual([])
  })
})

describe('remove_comfy_workflow [CW-6a; rule 10]', () => {
  it('asks as a delete and replies the workflow ID only', async () => {
    x = await askSetUp()
    const checked = checkWorkflowText(fixtureText('picture'))
    if (!checked.ok) throw new Error('the picture fixture failed the checks')
    const store = x.core.deps.comfyWorkflows
    const id = store.add({ checked: checked.data, name: 'Beach', addedBy: 'agent' }).stored.id
    const t = await x.session()
    const pending = t.call('remove_comfy_workflow', { workflow_id: id })
    const asked = await x.nthAsk()
    expect(asked).toMatchObject({ kind: 'delete', target: 'Workflow "Beach"' })
    data(await answer(x, asked.requestId, true))
    const reply = await pending
    expect(replyJson(reply)).toEqual({ workflowId: id })
    expect(store.list()).toEqual([])
  })

  it('refuses a shipped ID and a path-like ID by the input schema, with no event', async () => {
    x = await askSetUp()
    const t = await x.session()
    for (const workflowId of ['moss-text-to-image', 'custom-../../x']) {
      const reply = await t.call('remove_comfy_workflow', { workflow_id: workflowId })
      expect(reply.isError, workflowId).toBe(true)
    }
    expect(x.asked()).toEqual([])
  })
})
