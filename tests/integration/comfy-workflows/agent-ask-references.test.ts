// CW-6b follow-up (spec/comfyui-custom.md "The agent's ask"): agent.askWorkflow gives the
// reference count with the name, job, start and node types, so the dialog builds the job words
// itself and never reads the target line. It is taken from the same held workflow as the
// target, and the query stays user only.
import { afterEach, describe, expect, it } from 'vitest'
import { data } from '../core-fixture'
import { askSetUp, type AskSetUp } from '../mcp/ask-fixture'
import { fixtureText, type CustomFixture } from '../../fixtures/comfy-custom/load'

let x: AskSetUp | undefined
afterEach(async () => {
  await x?.close()
  x = undefined
})

const add = (s: AskSetUp, fixture: CustomFixture) =>
  s.agent('comfyWorkflow.add', { name: 'Harbour at dusk', workflowJson: fixtureText(fixture) })

const askWorkflow = (s: AskSetUp, requestId: string, actor: 'user' | 'agent' = 'user') =>
  s.core.query('agent.askWorkflow', { requestId }, { actor })

describe('agent.askWorkflow gives the reference count [CW-6b]', () => {
  it.each([
    ['two-refs', 'image_refs', null, 'Picture from a prompt and {n}'],
    ['video-refs', 'video', 'references', 'Video from {n}'],
  ] as Array<[CustomFixture, string, string | null, string]>)(
    'holds the count of %s, the one the target line names',
    async (fixture, job, start, words) => {
      x = await askSetUp()
      const pending = add(x, fixture)
      const asked = await x.nthAsk()
      const reply = data<Record<string, unknown>>(await askWorkflow(x, asked.requestId))
      expect(Object.keys(reply).sort()).toEqual(['job', 'name', 'nodeTypes', 'references', 'start'])
      expect(reply).toMatchObject({ job, start })
      const n = reply.references as number
      expect(n).toBeGreaterThanOrEqual(1)
      const pictures = n === 1 ? '1 reference picture' : `${n} reference pictures`
      expect(asked.target).toContain(`: ${words.replace('{n}', pictures)}, `)
      expect(await askWorkflow(x, asked.requestId, 'agent')).toMatchObject({
        ok: false,
        error: { code: 'AGENT_DENIED' },
      })
      data(await x.user('agent.answerPermission', {
        requestId: asked.requestId,
        allow: false,
        rememberAuto: false,
      }))
      await pending
    },
  )

  it('gives 0 for a picture from a prompt', async () => {
    x = await askSetUp()
    const pending = add(x, 'picture')
    const asked = await x.nthAsk()
    expect(data(await askWorkflow(x, asked.requestId))).toMatchObject({ references: 0 })
    data(await x.user('agent.answerPermission', {
      requestId: asked.requestId,
      allow: false,
      rememberAuto: false,
    }))
    await pending
  })
})
