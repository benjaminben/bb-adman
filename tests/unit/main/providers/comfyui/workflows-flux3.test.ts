import { describe, it, expect } from 'vitest'
import { WORKFLOWS, NON_DRAFT_WORKFLOWS } from '@/main/providers/comfyui/workflows'
import { flux3KleinEditReferences as flux } from '@/main/providers/comfyui/workflows/flux3'
import { LEAVES } from '@/main/providers/comfyui/workflows/common'
import { offeredWorkflow } from '@/main/providers/comfyui/workflows/offered'
import { fillWorkflow } from '@/main/providers/comfyui/fill'
import { WORKFLOW_IDS } from '@/shared/schemas/queries/comfy'

const USER_DEV = { devTools: true, actor: 'user' } as const

describe('flux3-klein-edit-references, the seventh workflow [SPEC 14 1.46 part B]', () => {
  it('joins the fixed list and the shipped workflows at the end', () => {
    // P4-9: birefnet-cutout now follows it, as the eighth.
    expect(WORKFLOW_IDS.indexOf('flux3-klein-edit-references')).toBe(6)
    expect(WORKFLOW_IDS).toHaveLength(8)
    expect(WORKFLOWS.find((w) => w.id === 'flux3-klein-edit-references')).toBe(flux)
    expect(WORKFLOWS.indexOf(flux)).toBe(6)
  })

  it('is a trial picture-from-references workflow on FLUX 3 klein', () => {
    expect(flux).toMatchObject({
      id: 'flux3-klein-edit-references',
      version: 1,
      label: 'FLUX 3 klein: picture from a prompt and one reference picture',
      job: 'image_refs',
      status: 'trial',
      model: { label: 'FLUX 3 klein', mainFile: 'flux3-image-klein-base-int8-convrot.safetensors' },
    })
    expect(flux.videoStart).toBeUndefined()
    expect(flux.video).toBeUndefined()
  })

  it('needs the three model files, core nodes only, and no minimum version', () => {
    expect(flux.needs).toEqual({
      minComfyVersion: '0.0.0',
      checkedWith: '',
      models: [
        { folder: 'diffusion_models', file: 'flux3-image-klein-base-int8-convrot.safetensors' },
        { folder: 'text_encoders', file: 'qwen3vl_4b_int8_convrot.safetensors' },
        { folder: 'vae', file: 'flux2-vae.safetensors' },
      ],
      nodeClasses: [
        'UNETLoader',
        'CLIPLoader',
        'VAELoader',
        'LoadImage',
        'CLIPTextEncode',
        'ReferenceMultiLatent',
        'KSampler',
        'VAEDecode',
        'PreviewImage',
      ],
      addOns: [],
    })
  })

  it('fills the prompt, the seed and one picture, and has no size slot', () => {
    expect(flux.slots).toEqual({
      prompt: { node: '6', input: 'text' },
      seed: [{ node: '9', input: 'seed' }],
      references: [
        { image: { node: '10', input: 'image' }, dropWhenUnused: { nodes: [], inputs: [] } },
      ],
      minReferences: 1,
      outputNode: '15',
    })
  })

  it('keeps the settings of the reference file in its graph', () => {
    const g = flux.graph
    expect(g['4']?.inputs).toMatchObject({ type: 'flux3' })
    expect(g['7']?.inputs).toMatchObject({ text: '' })
    expect(g['8']?.inputs).toMatchObject({
      'images.image0': ['10', 0],
      resolution: 'resize',
      'resolution.megapixels': 1,
    })
    expect(g['9']?.inputs).toMatchObject({
      steps: 50,
      cfg: 1,
      sampler_name: 'euler',
      scheduler: 'simple',
      denoise: 1,
    })
  })

  it('has a size rule no run reads, the unverified licence, and what it leaves', () => {
    expect(flux.size).toEqual({ multiple: 16, minPixels: 1_000_000, maxPixels: 1_000_000 })
    expect(flux.licence).toEqual({
      name: 'Not verified',
      url: '',
      commercialNote:
        'The licence of this model has not been checked. Commercial use may need a licence from its maker. Holding it is your responsibility.',
    })
    expect(flux.leavesOnServer).toEqual([LEAVES.uploads, LEAVES.preview, LEAVES.record])
  })

  it('names its source and each hand change, the PreviewImage swap included', () => {
    expect(flux.source.template).toBe('stakeholder reference file, Flux 3 klein image edit')
    expect(flux.source.exportedFrom).toBe('agent draft, never opened in ComfyUI')
    expect(flux.source.changes).toContain('SaveImage swapped for PreviewImage')
    for (const left of ['Flux3LayoutPrompt', 'TextGenerate', 'ComfySwitchNode', 'ImageCompare']) {
      expect(
        flux.source.changes.some((c) => c.includes(left)),
        left,
      ).toBe(true)
    }
  })

  it('is the workflow a reference run gets, with dev tools on, for the user [1.46 part B]', () => {
    expect(NON_DRAFT_WORKFLOWS).toContain(flux)
    expect(offeredWorkflow({ job: 'image_refs' }, USER_DEV)).toBe(flux)
    // [D-080] an agent gets a trial workflow as the user does, only with dev tools on.
    expect(offeredWorkflow({ job: 'image_refs' }, { devTools: true, actor: 'agent' })).toBe(flux)
    expect(offeredWorkflow({ job: 'image_refs' }, { devTools: false, actor: 'agent' })).toBeNull()
  })

  it('takes one picture: a fill sets it, and a width or a second picture throws', () => {
    const g = fillWorkflow(flux, { prompt: 'p', references: ['adman/adman-0123456789abcdef.png'] })
    expect(g['10']?.inputs.image).toBe('adman/adman-0123456789abcdef.png')
    expect(g['6']?.inputs.text).toBe('p')
    expect(() => fillWorkflow(flux, { prompt: 'p', references: ['a.png', 'b.png'] })).toThrow(Error)
    expect(() =>
      fillWorkflow(flux, { prompt: 'p', width: 1024, height: 1024, references: ['a.png'] }),
    ).toThrow(Error)
  })
})
