import { describe, it, expect } from 'vitest'
import { fillWorkflow } from '../../../../../src/main/providers/comfyui/fill'
import {
  h3ImageToVideo,
  h3ReferenceToVideo as spec,
  h3TextToVideo,
} from '../../../../../src/main/providers/comfyui/workflows/h3'
import {
  AGENT_DRAFT,
  H3_FIRST_RUN_SIZE,
  H3_REF_FILE,
  H3_VIDEO,
} from '../../../../../src/main/providers/comfyui/workflows/common'
import { offeredWorkflow } from '../../../../../src/main/providers/comfyui/workflows/offered'

const PROMPT_ID = '0b7e8f52-5d1c-4c1e-9a3e-2f6f1d9b7c10'
const REFS = { job: 'video', videoStart: { firstFrame: false, references: true } } as const

const graphClasses = () => [...new Set(Object.values(spec.graph).map((n) => n.class_type))].sort()

describe('h3-reference-to-video as trial [SPEC 14 1.54 P-4 part 2, comfy-workflows/h3-video-references.json]', () => {
  it('is a trial with the slots of the notes: node 5, node 6, node 15 image, node 14 [1.59 L-16]', () => {
    expect(spec.status).toBe('trial')
    expect(spec.slots).toEqual({
      prompt: { node: '5', input: 'prompt' },
      seed: [{ node: '6', input: 'noise_seed' }],
      width: { node: '5', input: 'width' },
      height: { node: '5', input: 'height' },
      frames: { node: '5', input: 'length' },
      references: [
        { image: { node: '15', input: 'image' }, dropWhenUnused: { nodes: [], inputs: [] } },
      ],
      minReferences: 1,
      alwaysDrop: { nodes: ['16'], inputs: [{ node: '5', input: 'ref_images.ref_image_1' }] },
      outputPrefix: { node: '14', input: 'filename_prefix' },
      outputNode: '14',
    })
  })

  it('declares at most one reference and at least one, so only what ran is offered [1.59 L-16]', () => {
    expect(spec.slots.references).toHaveLength(1)
    expect(spec.slots.minReferences).toBe(1)
    const base = { prompt: 'p', width: 576, height: 576, frames: 56, promptId: PROMPT_ID }
    expect(() => fillWorkflow(spec, { ...base, references: ['a.png', 'b.png'] })).toThrow(Error)
  })

  it('keeps node 16 and its ref_image_1 key in the shipped graph as data', () => {
    expect(spec.graph['16']?.class_type).toBe('LoadImage')
    expect(spec.graph['5']?.inputs['ref_images.ref_image_1']).toEqual(['16', 0])
  })

  it('wires each LoadImage into a ref_images key of MiniMaxH3ReferenceToVideo', () => {
    expect(spec.graph['5']?.class_type).toBe('MiniMaxH3ReferenceToVideo')
    expect(spec.graph['15']?.class_type).toBe('LoadImage')
    expect(spec.graph['16']?.class_type).toBe('LoadImage')
    expect(spec.graph['5']?.inputs['ref_images.ref_image_0']).toEqual(['15', 0])
    expect(spec.graph['5']?.inputs['ref_images.ref_image_1']).toEqual(['16', 0])
    expect(spec.graph['5']?.inputs.audio_vae).toEqual(['4', 0])
  })

  it('needs exactly the classes its graph uses: the text list with the reference node and LoadImage', () => {
    expect([...spec.needs.nodeClasses].sort()).toEqual(graphClasses())
    const fromText = h3TextToVideo.needs.nodeClasses.filter((c) => c !== 'MiniMaxH3ImageToVideo')
    expect([...spec.needs.nodeClasses].sort()).toEqual(
      [...fromText, 'MiniMaxH3ReferenceToVideo', 'LoadImage'].sort(),
    )
  })

  it('needs the ref2va model in place of the text model, and the shared H3 files', () => {
    const main = spec.needs.models.filter((m) => m.folder === 'diffusion_models')
    expect(main).toEqual([{ folder: 'diffusion_models', file: H3_REF_FILE }])
    const shared = (list: typeof spec.needs.models) =>
      list.filter((m) => m.folder !== 'diffusion_models')
    expect(shared(spec.needs.models)).toEqual(shared(h3TextToVideo.needs.models))
    expect(spec.needs.minComfyVersion).toBe(h3TextToVideo.needs.minComfyVersion)
    expect(spec.model).toEqual({ label: 'MiniMax H3', mainFile: H3_REF_FILE })
  })

  it('runs at the first-run size with the H3 timing, and records the full size', () => {
    expect(spec.size).toBe(H3_FIRST_RUN_SIZE)
    expect(spec.video).toBe(H3_VIDEO)
    expect(spec.source.changes).toContain(
      'first-run size; full size is { multiple: 32, minPixels: 589824, maxPixels: 1048576 }',
    )
  })

  it('bumps the version by one and says what was taken from the draft', () => {
    expect(spec.version).toBe(2)
    expect(spec.source.exportedFrom).toBe(AGENT_DRAFT)
    expect(spec.source.template).toMatch(/h3-video-references\.json/)
  })

  it('fills one reference and drops node 16 and its ref_image_1 key', () => {
    const g = fillWorkflow(spec, {
      prompt: 'p',
      width: 576,
      height: 576,
      frames: 56,
      references: ['adman/adman-0123456789abcdef.png'],
      promptId: PROMPT_ID,
    })
    expect(g['15']?.inputs.image).toBe('adman/adman-0123456789abcdef.png')
    expect(g['16']).toBeUndefined()
    expect(g['5']?.inputs).not.toHaveProperty('ref_images.ref_image_1')
    expect(g['5']?.inputs['ref_images.ref_image_0']).toEqual(['15', 0])
    expect(g['5']?.inputs).toMatchObject({ prompt: 'p', width: 576, height: 576, length: 56 })
    expect(g['14']?.inputs.filename_prefix).toBe(`adman/${PROMPT_ID}`)
  })

  it('refuses a fill with no reference', () => {
    const base = { prompt: 'p', width: 576, height: 576, frames: 56, promptId: PROMPT_ID }
    expect(() => fillWorkflow(spec, { ...base, references: [] })).toThrow(Error)
  })
})

describe('the videoStart filter with three trial video workflows [SPEC 14 1.54 P-4 condition]', () => {
  const who = { devTools: true, actor: 'user' } as const
  // The reference workflow first, so a lost filter would pick it for the wrong start.
  const list = [spec, h3ImageToVideo, h3TextToVideo]

  it('offers h3-reference-to-video for references only, to the user with dev tools on', () => {
    expect(offeredWorkflow(REFS, who)?.id).toBe('h3-reference-to-video')
    expect(offeredWorkflow(REFS, { devTools: false, actor: 'user' })).toBeNull()
    expect(offeredWorkflow(REFS, { devTools: true, actor: 'agent' })).toBeNull()
  })

  it('never picks it for no start or a first frame', () => {
    const none = { job: 'video', videoStart: { firstFrame: false, references: false } } as const
    const frame = { job: 'video', videoStart: { firstFrame: true, references: false } } as const
    expect(offeredWorkflow(none, who, list)?.id).toBe('h3-text-to-video')
    expect(offeredWorkflow(frame, who, list)?.id).toBe('h3-image-to-video')
  })
})
