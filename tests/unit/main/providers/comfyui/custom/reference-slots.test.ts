// spec/comfyui-custom.md "Marks", fewer pictures than ref marks (D-104): a custom workflow
// takes 1 picture up to its number of ref marks, and what a run with fewer pictures takes out
// of the graph is worked out from the graph alone.
import { describe, expect, it } from 'vitest'
import { checkWorkflowValue } from '@/main/providers/comfyui/custom/check-file'
import { toCustomSpec } from '@/main/providers/comfyui/custom/to-spec'
import { fillWorkflow } from '@/main/providers/comfyui/fill'
import type { Graph } from '@/main/providers/comfyui/workflows/types'
import type { CustomWorkflowId } from '@/shared/schemas/queries/comfy'
import { node } from './graph'

// Three pictures, each through its own resize, into one edit step by a named input each.
function threePictures(): Graph {
  return {
    '1': node('LoadImage', { image: 'a.png' }, 'adman: ref1'),
    '2': node('LoadImage', { image: 'b.png' }, 'adman: ref2'),
    '3': node('LoadImage', { image: 'c.png' }, 'adman: ref3'),
    '4': node('MadeUpResize', { image: ['1', 0], megapixels: 1 }),
    '5': node('MadeUpResize', { image: ['2', 0], megapixels: 1 }),
    '6': node('MadeUpResize', { image: ['3', 0], megapixels: 1 }),
    '7': node('MadeUpLoader', { name: 'model.safetensors' }),
    '8': node(
      'MadeUpEdit',
      { model: ['7', 0], first: ['4', 0], second: ['5', 0], third: ['6', 0], prompt: 'x', seed: 1 },
      'adman: prompt seed',
    ),
    '9': node('MadeUpPreview', { images: ['8', 0] }, 'adman: output'),
  }
}

function slotsOf(graph: Graph) {
  const check = checkWorkflowValue(graph)
  if (!check.ok) throw new Error(check.error.message)
  return check.data.slots
}

function specOf(graph: Graph) {
  const check = checkWorkflowValue(graph)
  if (!check.ok) throw new Error(check.error.message)
  return toCustomSpec({
    format: 1,
    id: 'custom-0123456789ab' as CustomWorkflowId,
    name: 'Three pictures',
    addedBy: 'user',
    addedAt: '2026-11-22T00:00:00.000Z',
    size: null,
    video: null,
    graph: check.data.graph,
  })
}

describe('reference slots of a custom workflow [D-104]', () => {
  it('runs with 1 picture up to the number of ref marks', () => {
    const slots = slotsOf(threePictures())
    expect(slots.minReferences).toBe(1)
    expect(slots.references).toHaveLength(3)
  })

  it('takes out an unused loader, the steps fed only by it, and the inputs linked to them', () => {
    const [first, second, third] = slotsOf(threePictures()).references ?? []
    expect(first?.dropWhenUnused).toEqual({ nodes: [], inputs: [] })
    expect(third?.dropWhenUnused).toEqual({
      nodes: ['3', '6'],
      inputs: [{ node: '8', input: 'third' }],
    })
    expect(new Set(second?.dropWhenUnused.nodes)).toEqual(new Set(['2', '3', '5', '6']))
    expect(second?.dropWhenUnused.inputs).toEqual([
      { node: '8', input: 'second' },
      { node: '8', input: 'third' },
    ])
  })

  it('fills a run of one picture: the other loaders and their inputs are gone', () => {
    const filled = fillWorkflow(specOf(threePictures()), {
      prompt: 'a red kite',
      references: ['up-1.png'],
    })
    expect(Object.keys(filled).sort()).toEqual(['1', '4', '7', '8', '9'])
    expect(filled['1']?.inputs.image).toBe('up-1.png')
    expect(filled['8']?.inputs).toEqual({
      model: ['7', 0],
      first: ['4', 0],
      prompt: 'a red kite',
      seed: expect.any(Number),
    })
  })

  it('fills a run of every picture with nothing taken out', () => {
    const filled = fillWorkflow(specOf(threePictures()), {
      prompt: 'a red kite',
      references: ['up-1.png', 'up-2.png', 'up-3.png'],
    })
    expect(Object.keys(filled)).toHaveLength(9)
  })

  it('keeps a step that has another live link, even when it is fed by an unused loader', () => {
    const graph = threePictures()
    graph['6'] = node('MadeUpEncode', { pixels: ['3', 0], vae: ['7', 0] })
    const third = slotsOf(graph).references?.[2]
    expect(third?.dropWhenUnused).toEqual({
      nodes: ['3'],
      inputs: [{ node: '6', input: 'pixels' }],
    })
  })

  it('needs every picture when taking one out would take a marked step with it', () => {
    const graph = threePictures()
    // The output step is fed only by the third picture's resize.
    graph['9'] = node('MadeUpPreview', { images: ['6', 0] }, 'adman: output')
    const slots = slotsOf(graph)
    expect(slots.minReferences).toBe(3)
    expect(slots.references?.map((r) => r.dropWhenUnused)).toEqual([
      { nodes: [], inputs: [] },
      { nodes: [], inputs: [] },
      { nodes: [], inputs: [] },
    ])
  })

  it('offers each count down to the lowest that leaves the marked steps in place', () => {
    const graph = threePictures()
    // The seed step is fed only by the second picture's resize.
    graph['8'] = node(
      'MadeUpEdit',
      { model: ['7', 0], first: ['4', 0], third: ['6', 0], prompt: 'x', latent: ['10', 0] },
      'adman: prompt',
    )
    graph['10'] = node('MadeUpNoise', { image: ['5', 0], seed: 1 }, 'adman: seed')
    const slots = slotsOf(graph)
    expect(slots.minReferences).toBe(2)
    expect(slots.references?.[2]?.dropWhenUnused.nodes).toEqual(['3', '6'])
    expect(slots.references?.[1]?.dropWhenUnused.nodes).toEqual([])
  })

  it('gives a workflow with one ref mark exactly one picture', () => {
    const graph = threePictures()
    delete graph['2']
    delete graph['3']
    delete graph['5']
    delete graph['6']
    graph['8'] = node(
      'MadeUpEdit',
      { model: ['7', 0], first: ['4', 0], prompt: 'x', seed: 1 },
      'adman: prompt seed',
    )
    const slots = slotsOf(graph)
    expect(slots.minReferences).toBe(1)
    expect(slots.references).toHaveLength(1)
  })
})
