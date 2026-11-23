// CW-6a review follow-up (spec/comfyui-custom.md "The agent's ask"): an agent's add whose
// cleaned name is taken, or that would pass the 50 limit, is refused before any ask event,
// with the store's own code, reason and fixed sentence. A free name still asks.
import { afterEach, describe, expect, it } from 'vitest'
import { data } from '../core-fixture'
import { askSetUp, type AskSetUp } from '../mcp/ask-fixture'
import { checked } from './store-fixture'
import { fixtureText } from '../../fixtures/comfy-custom/load'
import { MAX_CUSTOM_WORKFLOWS } from '@/shared/comfy/custom-workflow'

let x: AskSetUp | undefined
afterEach(async () => {
  await x?.close()
  x = undefined
})

const add = (s: AskSetUp, name: string) =>
  s.agent('comfyWorkflow.add', { name, workflowJson: fixtureText('picture') })

const store = (s: AskSetUp, name: string) =>
  s.core.deps.comfyWorkflows.add({ checked: checked('picture'), name, addedBy: 'user' })

const count = (s: AskSetUp) => s.core.deps.comfyWorkflows.list().length

describe('name taken and the limit are refused before the ask [CW-6a]', () => {
  it('refuses a taken name (trimmed, any letter case) with no event and nothing saved', async () => {
    x = await askSetUp()
    store(x, 'Harbour at Dusk')
    expect(await add(x, '  harbour AT dusk ')).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'A workflow with that name already exists.',
        details: { reason: 'workflow_name_taken' },
      },
    })
    expect(x.asked()).toEqual([])
    expect(count(x)).toBe(1)
  })

  it('refuses an add when 50 are stored, with no event and nothing saved', async () => {
    x = await askSetUp()
    for (let i = 1; i <= MAX_CUSTOM_WORKFLOWS; i++) store(x, `Workflow ${i}`)
    expect(await add(x, 'One more')).toEqual({
      ok: false,
      error: {
        code: 'RULE_VIOLATION',
        message: 'You can add at most 50 workflows. Remove one first.',
        details: { reason: 'workflow_limit' },
      },
    })
    expect(x.asked()).toEqual([])
    expect(count(x)).toBe(MAX_CUSTOM_WORKFLOWS)
  })

  it('still asks for a free name', async () => {
    x = await askSetUp()
    store(x, 'Harbour')
    const pending = add(x, 'Forest')
    const asked = await x.nthAsk()
    expect(asked.kind).toBe('workflow')
    data(await x.user('agent.answerPermission', { requestId: asked.requestId, allow: false, rememberAuto: false }))
    await pending
    expect(count(x)).toBe(1)
  })
})
