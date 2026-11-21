import { describe, it, expect } from 'vitest'
import { WORKFLOWS } from '@/main/providers/comfyui/workflows'
import type { Pointer, WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import { WORKFLOW_IDS } from '@/shared/schemas/queries/comfy'

function pointersOf(spec: WorkflowSpec): Pointer[] {
  const s = spec.slots
  return [
    ...(s.prompt ? [s.prompt] : []),
    ...s.seed,
    ...[s.width, s.height, s.firstFrame, s.frames, s.outputPrefix].filter(
      (p): p is Pointer => p !== undefined,
    ),
    ...(s.references ?? []).flatMap((r) => [r.image, ...r.dropWhenUnused.inputs]),
    ...(s.pad ? [s.pad.left, s.pad.top, s.pad.right, s.pad.bottom] : []),
  ]
}

const classes = (spec: WorkflowSpec) => Object.values(spec.graph).map((n) => n.class_type)
const each = WORKFLOWS.map((w) => [w.id, w] as const)

describe('the shipped workflows [SPEC 6.10.4, FR-258, FR-278]', () => {
  it('ships the seven workflows, once each, in the fixed list order', () => {
    expect(WORKFLOWS.map((w) => w.id)).toEqual([...WORKFLOW_IDS])
  })

  it('keeps every workflow as draft but the trial ones of the data step [SPEC 14 1.46]', () => {
    const trial = WORKFLOWS.filter((w) => w.status !== 'draft').map((w) => w.id)
    expect(trial).toEqual([
      'moss-text-to-image',
      'h3-text-to-video',
      'h3-image-to-video',
      'h3-reference-to-video',
      'flux3-klein-edit-references',
      'birefnet-cutout',
    ])
    expect(WORKFLOWS.every((w) => w.status === 'draft' || w.status === 'trial')).toBe(true)
  })

  it.each(each)('%s: every pointer names a node and an input that exist', (_id, spec) => {
    for (const p of pointersOf(spec)) {
      expect(spec.graph[p.node], `${p.node}.${p.input}`).toBeDefined()
      expect(Object.hasOwn(spec.graph[p.node]?.inputs ?? {}, p.input), p.input).toBe(true)
    }
    expect(spec.graph[spec.slots.outputNode]).toBeDefined()
    for (const r of spec.slots.references ?? []) {
      for (const node of r.dropWhenUnused.nodes) expect(spec.graph[node]).toBeDefined()
    }
  })

  it.each(each)('%s: every class_type in the graph is in needs.nodeClasses', (_id, spec) => {
    for (const c of classes(spec)) expect(spec.needs.nodeClasses).toContain(c)
  })

  it.each(each)('%s: no input value is text that starts with http:// or https://', (_id, spec) => {
    for (const node of Object.values(spec.graph)) {
      for (const value of Object.values(node.inputs)) {
        if (typeof value === 'string') expect(value).not.toMatch(/^https?:\/\//i)
      }
    }
  })

  it.each(each)('%s: needs no add-on [SPEC 14 1.39]', (_id, spec) => {
    expect(spec.needs.addOns).toEqual([])
  })

  it.each(each.filter(([, w]) => w.job !== 'video'))(
    '%s: a picture graph has exactly one PreviewImage, which is the outputNode, and no SaveImage',
    (_id, spec) => {
      const previews = Object.entries(spec.graph).filter(([, n]) => n.class_type === 'PreviewImage')
      expect(previews.map(([id]) => id)).toEqual([spec.slots.outputNode])
      expect(classes(spec)).not.toContain('SaveImage')
    },
  )

  it.each(each.filter(([, w]) => w.job === 'video'))(
    '%s: a video graph has exactly one SaveVideo, which is the outputNode [1.39: sound kept]',
    (_id, spec) => {
      const saves = Object.entries(spec.graph).filter(([, n]) => n.class_type === 'SaveVideo')
      expect(saves.map(([id]) => id)).toEqual([spec.slots.outputNode])
      expect(spec.video).toBeDefined()
      expect(spec.slots.outputPrefix?.node).toBe(spec.slots.outputNode)
    },
  )

  it('states the oldest ComfyUI version of each workflow [SPEC 6.10.4, 14 1.39]', () => {
    const versions = Object.fromEntries(WORKFLOWS.map((w) => [w.id, w.needs.minComfyVersion]))
    expect(versions).toEqual({
      'moss-text-to-image': '0.42.0',
      'moss-edit-references': '0.43.0',
      'moss-extend': '0.43.0',
      'h3-text-to-video': '0.33.0',
      'h3-image-to-video': '0.33.0',
      'h3-reference-to-video': '0.33.0',
      'flux3-klein-edit-references': '0.0.0',
      'birefnet-cutout': '0.0.0',
    })
  })

  it('gives each video workflow its start kind, and a picture workflow none [FR-286]', () => {
    const starts = Object.fromEntries(WORKFLOWS.map((w) => [w.id, w.videoStart]))
    expect(starts).toEqual({
      'moss-text-to-image': undefined,
      'moss-edit-references': undefined,
      'moss-extend': undefined,
      'h3-text-to-video': { firstFrame: false, references: false },
      'h3-image-to-video': { firstFrame: true, references: false },
      'h3-reference-to-video': { firstFrame: false, references: true },
    })
  })

  it('sets a commercial note for MiniMax H3 and none for MOSS-Image [FR-285]', () => {
    for (const w of WORKFLOWS) {
      if (w.model.label === 'MiniMax H3') expect(w.licence.commercialNote).toMatch(/licen/i)
      else if (w.model.label === 'MOSS-Image') expect(w.licence.commercialNote).toBeNull()
      // [1.46] OI-76: the Flux licence is not verified, and the note says so.
      else if (w.model.label === 'FLUX 3 klein') {
        expect(w.licence.name).toBe('Not verified')
        expect(w.licence.commercialNote).toMatch(/not been checked/)
      } else if (w.model.label === 'BiRefNet') {
        // P4-9: MIT, so no licence dialog.
        expect(w.licence.name).toBe('MIT')
        expect(w.licence.commercialNote).toBeNull()
      } else expect.fail(`${w.id}: no licence rule for the model ${w.model.label}`)
    }
  })

  it('says what each workflow leaves on the server [SPEC 6.10.10, FR-271]', () => {
    for (const w of WORKFLOWS) {
      expect(w.leavesOnServer.length).toBeGreaterThan(0)
      const video = w.leavesOnServer.some((s) => /output folder/.test(s))
      expect(video).toBe(w.job === 'video')
    }
  })
})

describe('birefnet-cutout, the cut-out workflow [P4-9, spec/ai-jobs.md "Cut-out"]', () => {
  const spec = WORKFLOWS.find((w) => w.id === 'birefnet-cutout')
  if (!spec) throw new Error('birefnet-cutout is not shipped')

  it('is the six-node graph of the spec, its output at node 6', () => {
    expect(spec.graph).toEqual({
      '1': { class_type: 'LoadImage', inputs: { image: expect.any(String) } },
      '2': {
        class_type: 'LoadBackgroundRemovalModel',
        inputs: { bg_removal_name: 'birefnet.safetensors' },
      },
      '3': {
        class_type: 'RemoveBackground',
        inputs: { bg_removal_model: ['2', 0], image: ['1', 0] },
      },
      '4': { class_type: 'InvertMask', inputs: { mask: ['3', 0] } },
      '5': { class_type: 'JoinImageWithAlpha', inputs: { image: ['1', 0], alpha: ['4', 0] } },
      '6': { class_type: 'PreviewImage', inputs: { images: ['5', 0] } },
    })
    expect(spec.slots).toEqual({
      seed: [],
      references: [
        { image: { node: '1', input: 'image' }, dropWhenUnused: { nodes: [], inputs: [] } },
      ],
      minReferences: 1,
      outputNode: '6',
    })
  })

  it('every link points at a node that exists', () => {
    for (const node of Object.values(spec.graph)) {
      for (const value of Object.values(node.inputs)) {
        if (Array.isArray(value) && typeof value[0] === 'string') {
          expect(spec.graph[value[0]], value[0]).toBeDefined()
        }
      }
    }
  })

  it('states the job, status, model, needs, licence and what it leaves', () => {
    expect(spec).toMatchObject({
      job: 'cutout',
      status: 'trial',
      model: { label: 'BiRefNet', mainFile: 'birefnet.safetensors' },
      size: { multiple: 1, minPixels: 1 },
      licence: { name: 'MIT', commercialNote: null },
    })
    expect(spec.needs).toEqual({
      minComfyVersion: '0.0.0',
      checkedWith: '',
      models: [{ folder: 'background_removal', file: 'birefnet.safetensors' }],
      nodeClasses: [
        'LoadImage',
        'LoadBackgroundRemovalModel',
        'RemoveBackground',
        'InvertMask',
        'JoinImageWithAlpha',
        'PreviewImage',
      ],
      addOns: [],
    })
    expect(spec.leavesOnServer).toHaveLength(3)
    expect(spec.videoStart).toBeUndefined()
  })
})
