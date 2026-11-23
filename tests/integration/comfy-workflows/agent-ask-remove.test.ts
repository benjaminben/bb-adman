// CW-6a (spec/comfyui-custom.md "The agent's ask", "Security" rule 10): an agent's
// comfyWorkflow.remove asks as a delete, with the target line `Workflow "{name}"`; the
// person's "don't ask again for deletes" covers it. The reply is the workflow ID only.
import fs from 'node:fs'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { data } from '../core-fixture'
import { askSetUp, type AskSetUp } from '../mcp/ask-fixture'
import { checked } from './store-fixture'

let x: AskSetUp | undefined
afterEach(async () => {
  await x?.close()
  x = undefined
})

function stored(s: AskSetUp, name = 'Beach at noon'): string {
  return s.core.deps.comfyWorkflows.add({ checked: checked('picture'), name, addedBy: 'user' })
    .stored.id
}

const remove = (s: AskSetUp, workflowId: string) =>
  s.agent('comfyWorkflow.remove', { workflowId })

const answer = (s: AskSetUp, requestId: string, allow: boolean, rememberAuto = false) =>
  s.user('agent.answerPermission', { requestId, allow, rememberAuto })

const ids = (s: AskSetUp) => s.core.deps.comfyWorkflows.list().map((e) => e.stored.id)

describe('comfyWorkflow.remove asks as a delete [CW-6a]', () => {
  it('asks with kind delete and the workflow name; allow removes it and gives the ID only', async () => {
    x = await askSetUp()
    const id = stored(x)
    const pending = remove(x, id)
    const asked = await x.nthAsk()
    expect(asked).toMatchObject({
      action: 'remove ComfyUI workflows',
      kind: 'delete',
      fileCount: 0,
      target: 'Workflow "Beach at noon"',
    })
    expect(ids(x)).toEqual([id])
    expect(await x.core.query('agent.askWorkflow', { requestId: asked.requestId }, { actor: 'user' }))
      .toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    data(await answer(x, asked.requestId, true))
    const reply = await pending
    expect(data(reply)).toEqual({ workflowId: id })
    expect(ids(x)).toEqual([])
    const dir = path.join(x.core.deps.userDataDir, 'comfy-workflows')
    expect(fs.readdirSync(dir)).toEqual([])
  })

  it('refuse removes nothing', async () => {
    x = await askSetUp()
    const id = stored(x)
    const pending = remove(x, id)
    data(await answer(x, (await x.nthAsk()).requestId, false))
    expect(await pending).toMatchObject({ ok: false, error: { code: 'AGENT_REFUSED' } })
    expect(ids(x)).toEqual([id])
  })

  it('is answered by mcp.autoApproveDestructive, with no event', async () => {
    x = await askSetUp()
    const id = stored(x)
    data(await x.user('settings.update', { mcp: { autoApproveDestructive: true } }))
    expect(data(await remove(x, id))).toEqual({ workflowId: id })
    expect(x.asked()).toEqual([])
    expect(ids(x)).toEqual([])
  })

  it('"remember" on an allowed remove turns on the delete setting', async () => {
    x = await askSetUp()
    const first = stored(x)
    const second = stored(x, 'Forest')
    const pending = remove(x, first)
    data(await answer(x, (await x.nthAsk()).requestId, true, true))
    data(await pending)
    expect(x.core.settings.get().mcp.autoApproveDestructive).toBe(true)
    expect(data(await remove(x, second))).toEqual({ workflowId: second })
    expect(x.asked()).toHaveLength(1)
  })

  it('cleans the stored name in the target line', async () => {
    x = await askSetUp()
    const id = stored(x, `Beach${String.fromCharCode(0x202e)}"quoted"`)
    const pending = remove(x, id)
    const asked = await x.nthAsk()
    expect(asked.target.includes(String.fromCharCode(0x202e))).toBe(false)
    expect(asked.target.startsWith('Workflow "Beach')).toBe(true)
    data(await answer(x, asked.requestId, false))
    await pending
  })
})
