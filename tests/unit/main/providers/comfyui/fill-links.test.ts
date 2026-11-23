import { describe, it, expect } from 'vitest'
import { fillWorkflow } from '@/main/providers/comfyui/fill'
import type { Graph, WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import { mossTextToImage } from '@/main/providers/comfyui/workflows/moss'
import { toCustomSpec } from '@/main/providers/comfyui/custom/to-spec'
import { storedFrom } from './custom/stored'

const SIZE = { width: 1024, height: 1024 }

// The two-reference custom fixture, with one more input on its edit step.
function twoRefsWith(input: string, value: unknown): WorkflowSpec {
  const stored = storedFrom('two-refs')
  const graph: Graph = structuredClone(stored.graph)
  const edit = graph['3']
  if (!edit) throw new Error('fixture changed')
  edit.inputs[input] = value
  return toCustomSpec({ ...stored, graph })
}

describe('fillWorkflow: the link test of the file checks [D-104, CW-3]', () => {
  it('fills a custom graph holding a plain two-item list of text as a value', () => {
    const spec = twoRefsWith('names', ['gone', 'x'])
    const g = fillWorkflow(spec, { prompt: 'p', references: ['1.png', '2.png'] })
    expect(g['3']?.inputs.names).toEqual(['gone', 'x'])
    expect(g['1']?.inputs.image).toBe('1.png')
  })

  it('finds a link to an inherited name such as constructor dangling', () => {
    const spec: WorkflowSpec = {
      ...mossTextToImage,
      graph: {
        ...mossTextToImage.graph,
        extra: { class_type: 'Note', inputs: { from: ['constructor', 0] } },
      },
      slots: {
        ...mossTextToImage.slots,
        references: [
          {
            image: { node: 'extra', input: 'from' },
            dropWhenUnused: { nodes: [], inputs: [] },
          },
        ],
        minReferences: 0,
      },
    }
    expect(() => fillWorkflow(spec, { prompt: 'p', ...SIZE, references: [] })).toThrow(
      'A link points at a node that was dropped',
    )
  })
})

describe('fillWorkflow: fixed error sentences [D-104, CW-3]', () => {
  const MARK = 'marker-7f3a'
  const pointedAt = (pointer: { node: string; input: string }): WorkflowSpec => ({
    ...mossTextToImage,
    slots: { ...mossTextToImage.slots, prompt: pointer },
  })
  const messageOf = (spec: WorkflowSpec) => {
    try {
      fillWorkflow(spec, { prompt: 'p', ...SIZE })
    } catch (e) {
      return (e as Error).message
    }
    return 'filled'
  }

  it('names no node ID when the graph lacks the node', () => {
    const message = messageOf(pointedAt({ node: MARK, input: 'text' }))
    expect(message).toBe('The graph has no step the workflow names.')
    expect(message).not.toContain(MARK)
  })

  it('names no node ID and no input name when the node lacks the input', () => {
    const node = mossTextToImage.slots.prompt?.node ?? ''
    const message = messageOf(pointedAt({ node, input: MARK }))
    expect(message).toBe('A step has no input the workflow names.')
    expect(message).not.toContain(MARK)
    expect(message).not.toContain(`Node ${node}`)
  })
})
