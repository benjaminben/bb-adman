import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { fixtureText } from '../../fixtures/comfy-custom/load'
import { rememberWorkflowPath } from '@/main/providers/comfyui/custom/chosen-workflow-path'
import { comfyWorkflowAdd } from '@/main/commands/comfy/workflow-add'

let f: Fixture
afterEach(() => f.cleanup())

const MARKER = 'QX7MARKER'

// The picture fixture with the marker in a node ID, a class name, an input name, an input
// value and a title, so it still passes the checks.
function markedGraph(): string {
  const graph = JSON.parse(fixtureText('picture')) as Record<string, unknown>
  graph[`${MARKER}-node`] = {
    class_type: `${MARKER}Class`,
    inputs: { [`${MARKER}_input`]: `${MARKER} value`, images: ['8', 0] },
    _meta: { title: `${MARKER} title` },
  }
  return JSON.stringify(graph)
}

const markedCanvas = () =>
  JSON.stringify({ nodes: [{ title: MARKER }], links: [], extra: { [MARKER]: MARKER } })

describe('no graph text in a reply, a log line or an event [D-104, rule 2]', () => {
  it('holds for both adds, the list, a refused add, a change and a remove', async () => {
    f = makeFixture()
    const file = path.join(f.root, 'harbour.json')
    fs.writeFileSync(file, markedGraph())
    rememberWorkflowPath(file)
    const replies: unknown[] = [await f.user('comfyWorkflow.addFromFile', { filePath: file })]

    const handler = comfyWorkflowAdd(f.core.deps)
    for (const workflowJson of [markedGraph(), markedCanvas()]) {
      const parsed = handler.parse({ name: `Agent ${replies.length}`, workflowJson })
      if (!parsed.ok) throw new Error('bad input')
      try {
        replies.push(await handler.run({ actor: 'agent', commandId: 'c' }, parsed.input))
      } catch (e) {
        replies.push({ message: (e as Error).message, details: (e as { details?: unknown }).details })
      }
    }
    replies.push(await f.agent('comfyWorkflow.add', { name: 'A', workflowJson: markedGraph() }))

    const canvas = path.join(f.root, 'canvas.json')
    fs.writeFileSync(canvas, markedCanvas())
    rememberWorkflowPath(canvas)
    replies.push(await f.user('comfyWorkflow.addFromFile', { filePath: canvas }))

    for (const actor of ['user', 'agent'] as const) {
      replies.push(await f.core.query('comfyWorkflow.list', {}, { actor }))
    }
    // The person's add and the handler's add of the marked graph were saved.
    expect(f.core.deps.comfyWorkflows.list()).toHaveLength(2)
    const [first] = f.core.deps.comfyWorkflows.list()
    const workflowId = first?.stored.id
    replies.push(await f.user('comfyWorkflow.update', { workflowId, name: 'Renamed' }))
    replies.push(await f.user('comfyWorkflow.remove', { workflowId }))

    f.restart()
    const seen = JSON.stringify([replies, f.events]) + f.readLogs()
    expect(seen).not.toContain(MARKER)
    expect(seen).not.toContain(f.root)
  })
})
