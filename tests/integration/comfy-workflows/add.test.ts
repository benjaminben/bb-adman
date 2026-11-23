import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { fixtureText } from '../../fixtures/comfy-custom/load'
import { comfyWorkflowAdd } from '@/main/commands/comfy/workflow-add'
import { CUSTOM_VIDEO_DEFAULT, CUSTOM_WORKFLOW_ID } from '@/shared/comfy/custom-workflow'
import type { Actor } from '@/shared/schemas/events'
import { AppError } from '@/shared/schemas/result'

let f: Fixture
afterEach(() => f.cleanup())

// The handler itself: the bus still refuses an agent until CW-6a turns the policy to ask.
async function run(actor: Actor, input: unknown) {
  const handler = comfyWorkflowAdd(f.core.deps)
  const parsed = handler.parse(input)
  if (!parsed.ok) return { code: 'INVALID_INPUT' }
  try {
    return (await handler.run({ actor, commandId: 'c1' }, parsed.input)).data
  } catch (e) {
    if (e instanceof AppError) return { code: e.code, message: e.message, ...e.details }
    throw e
  }
}

const VIDEO = { fps: 16, maxMs: 4_000, frameStep: 8, frameOffset: 1 }

describe("comfyWorkflow.add: the agent's add [D-104, CW-2]", () => {
  it('saves a good text as added by the agent, and replies with the ID only', async () => {
    f = makeFixture()
    const reply = await run('agent', { name: 'Beach', workflowJson: fixtureText('picture') })
    expect(Object.keys(reply as object)).toEqual(['workflowId'])
    const id = (reply as { workflowId: string }).workflowId
    expect(id).toMatch(CUSTOM_WORKFLOW_ID)
    expect(f.core.deps.comfyWorkflows.get(id)?.stored).toMatchObject({
      name: 'Beach',
      addedBy: 'agent',
      video: null,
    })
  })

  it('takes video values for a video graph, and the defaults without them', async () => {
    f = makeFixture()
    const given = await run('agent', {
      name: 'V1',
      workflowJson: fixtureText('video-prompt'),
      video: VIDEO,
    })
    const plain = await run('agent', { name: 'V2', workflowJson: fixtureText('video-refs') })
    const store = f.core.deps.comfyWorkflows
    expect(store.get((given as { workflowId: string }).workflowId)?.stored.video).toEqual(VIDEO)
    expect(store.get((plain as { workflowId: string }).workflowId)?.stored.video).toEqual(
      CUSTOM_VIDEO_DEFAULT,
    )
  })

  it('refuses the person with workflow_add_in_settings, and saves nothing', async () => {
    f = makeFixture()
    expect(await run('user', { name: 'Beach', workflowJson: fixtureText('picture') })).toEqual({
      code: 'RULE_VIOLATION',
      message: 'Add a workflow in Settings.',
      reason: 'workflow_add_in_settings',
    })
    expect(f.core.deps.comfyWorkflows.list()).toEqual([])
  })

  it.each([
    ['frames per second over 60', { ...VIDEO, fps: 61 }],
    ['a length not in whole seconds', { ...VIDEO, maxMs: 4_500 }],
    ['a frame step of 0', { ...VIDEO, frameStep: 0 }],
    ['an extra field', { ...VIDEO, loop: true }],
  ])('refuses a bad video value: %s', async (_label, video) => {
    f = makeFixture()
    const result = await run('agent', { name: 'V', workflowJson: fixtureText('video-prompt'), video })
    expect(result).toEqual({ code: 'INVALID_INPUT' })
  })

  it('refuses video values for a graph that makes no video', async () => {
    f = makeFixture()
    const result = await run('agent', {
      name: 'P',
      workflowJson: fixtureText('picture'),
      video: VIDEO,
    })
    expect(result).toMatchObject({ code: 'INVALID_INPUT' })
    expect(f.core.deps.comfyWorkflows.list()).toEqual([])
  })

  it('refuses a graph that fails the checks, and a taken name, with their sentences', async () => {
    f = makeFixture()
    const canvas = await run('agent', { name: 'C', workflowJson: fixtureText('canvas') })
    expect(canvas).toMatchObject({ code: 'RULE_VIOLATION', reason: 'workflow_canvas_format' })
    await run('agent', { name: 'Beach', workflowJson: fixtureText('picture') })
    const twin = await run('agent', { name: 'beach', workflowJson: fixtureText('two-refs') })
    expect(twin).toMatchObject({ reason: 'workflow_name_taken' })
  })

  it('is refused for an agent by the bus while its policy is deny', async () => {
    f = makeFixture()
    const result = await f.agent('comfyWorkflow.add', {
      name: 'Beach',
      workflowJson: fixtureText('picture'),
    })
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(f.core.deps.comfyWorkflows.list()).toEqual([])
  })
})
