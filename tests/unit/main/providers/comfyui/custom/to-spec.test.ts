import { describe, it, expect } from 'vitest'
import { toCustomSpec } from '@/main/providers/comfyui/custom/to-spec'
import { fillWorkflow, type FillValues } from '@/main/providers/comfyui/fill'
import { LEAVES, LEAVES_ORDER } from '@/main/providers/comfyui/workflows/common'
import type { Graph } from '@/main/providers/comfyui/workflows/types'
import { CUSTOM_SIZE_DEFAULTS } from '@/shared/comfy/custom-workflow'
import type { CustomFixture } from '../../../../../fixtures/comfy-custom/load'
import { storedFrom } from './stored'

describe('toCustomSpec: the in-memory table [D-104]', () => {
  it('fills every field for a picture workflow', () => {
    const size = { multiple: 64, minPixels: 1_677_722, maxPixels: 2_097_152 }
    const spec = toCustomSpec(storedFrom('picture', { size }))
    const { graph, slots, ...facts } = spec
    expect(facts).toEqual({
      id: 'custom-0123456789ab',
      label: 'Lighthouse pictures',
      job: 'image',
      status: 'custom',
      version: 1,
      model: { label: 'Custom workflow', mainFile: 'custom ComfyUI workflow' },
      needs: {
        minComfyVersion: '0.0.0',
        checkedWith: '',
        models: [],
        nodeClasses: [
          'CLIPTextEncode',
          'CheckpointLoaderSimple',
          'EmptyLatentImage',
          'KSampler',
          'PreviewImage',
          'VAEDecode',
        ],
        addOns: [],
      },
      size,
      licence: { name: 'Not known', url: '', commercialNote: null },
      leavesOnServer: [LEAVES.custom, LEAVES.record],
      source: { template: 'added by a person', exportedFrom: '', changes: [] },
    })
    expect(Object.keys(graph)).toHaveLength(7)
    expect(slots.seedBelow).toBe(2 ** 32)
    expect(slots.outputNode).toBe('9')
  })

  it('gives a video workflow its start, video values, default size and upload sentence', () => {
    const stored = storedFrom('video-first-frame', { addedBy: 'agent' })
    const spec = toCustomSpec(stored)
    expect(spec.job).toBe('video')
    expect(spec.videoStart).toEqual({ firstFrame: true, references: false })
    expect(spec.video).toEqual(stored.video)
    expect(spec.size).toEqual(CUSTOM_SIZE_DEFAULTS.video)
    expect(spec.source.template).toBe('added by an agent')
    expect(spec.leavesOnServer).toEqual([LEAVES.uploads, LEAVES.custom, LEAVES.record])
  })

  it('takes 1 picture up to as many as it has ref marks', () => {
    const spec = toCustomSpec(storedFrom('two-refs'))
    expect(spec.job).toBe('image_refs')
    expect(spec.slots.references).toHaveLength(2)
    expect(spec.slots.minReferences).toBe(1)
    expect(spec.size).toEqual(CUSTOM_SIZE_DEFAULTS.image_refs)
    expect(spec.leavesOnServer[0]).toBe(LEAVES.uploads)
    expect(spec).not.toHaveProperty('video')
    expect(spec).not.toHaveProperty('videoStart')
  })

  it('lists node types sorted and once each', () => {
    expect(toCustomSpec(storedFrom('video-refs')).needs.nodeClasses).toEqual([
      'LoadImage',
      'MadeUpReferenceToVideo',
      'MadeUpVideoSampler',
      'MadeUpVideoText',
      'SaveVideo',
    ])
  })

  it('throws for a graph that fails the file checks', () => {
    expect(() => toCustomSpec(storedFrom('picture', { graph: {} }))).toThrow()
  })

  it('puts the custom sentence before the server record in the fixed order', () => {
    expect(LEAVES.custom).toBe(
      'A workflow you add can leave files on the server wherever its own steps save them.',
    )
    expect(LEAVES_ORDER.indexOf(LEAVES.custom)).toBe(LEAVES_ORDER.indexOf(LEAVES.record) - 1)
  })
})

// The shipped-file rule, applied to a custom workflow: a fill changes only the marked inputs.
describe('a filled custom graph differs from the stored one only at the marked inputs', () => {
  const changed = (before: Graph, after: Graph) =>
    Object.entries(before).flatMap(([id, node]) =>
      Object.keys(node.inputs)
        .filter((k) => JSON.stringify(node.inputs[k]) !== JSON.stringify(after[id]?.inputs[k]))
        .map((k) => `${id}.${k}`),
    )

  const cases: Array<[CustomFixture, FillValues, string[]]> = [
    [
      'picture',
      { prompt: 'a red boat', width: 640, height: 448 },
      ['3.seed', '5.width', '5.height', '6.text'],
    ],
    [
      'two-refs',
      { prompt: 'p', references: ['adman/a.png', 'adman/b.png'] },
      ['1.image', '2.image', '3.prompt', '3.noise_seed'],
    ],
    [
      'video-prompt',
      { prompt: 'p', width: 320, height: 320, frames: 21 },
      ['1.text', '2.width', '2.height', '2.length', '3.seed'],
    ],
    [
      'video-first-frame',
      { prompt: 'p', width: 320, height: 320, frames: 21, firstFrame: 'adman/f.png' },
      ['1.text', '2.image', '3.width', '3.height', '3.num_frames', '4.seed'],
    ],
    [
      'video-refs',
      { prompt: 'p', frames: 21, references: ['adman/r.png'] },
      ['1.text', '2.image', '3.frames', '4.seed'],
    ],
  ]

  it.each(cases)('%s', (name, values, marked) => {
    const stored = storedFrom(name, name === 'picture' ? { size: CUSTOM_SIZE_DEFAULTS.image } : {})
    const spec = toCustomSpec(stored)
    const filled = fillWorkflow(spec, values)
    expect(Object.keys(filled)).toEqual(Object.keys(stored.graph))
    expect(changed(stored.graph, filled).sort()).toEqual([...marked].sort())
    for (const id of Object.keys(stored.graph)) {
      expect(filled[id]?.class_type).toBe(stored.graph[id]?.class_type)
    }
  })
})
