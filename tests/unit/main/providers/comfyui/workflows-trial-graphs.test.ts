import { describe, it, expect } from 'vitest'
import { NON_DRAFT_WORKFLOWS } from '../../../../../src/main/providers/comfyui/workflows'
import { mossTextToImage } from '../../../../../src/main/providers/comfyui/workflows/moss'
import {
  MOSS_FIRST_RUN_SIZE,
  MOSS_MODEL,
} from '../../../../../src/main/providers/comfyui/workflows/common'
import type { WorkflowSpec } from '../../../../../src/main/providers/comfyui/workflows/types'

// The folder each loader reads (comfy-workflows/REFERENCE-NOTES.md, "Model files").
const LOADER_FOLDER: Record<string, [string, string]> = {
  UNETLoader: ['unet_name', 'diffusion_models'],
  CLIPLoader: ['clip_name', 'text_encoders'],
  VAELoader: ['vae_name', 'vae'],
  LoraLoaderModelOnly: ['lora_name', 'loras'],
}

function graphModels(spec: WorkflowSpec) {
  return Object.values(spec.graph).flatMap((n) => {
    const loader = LOADER_FOLDER[n.class_type]
    return loader ? [{ folder: loader[1], file: n.inputs[loader[0]] }] : []
  })
}

const sortedClasses = (spec: WorkflowSpec) =>
  [...new Set(Object.values(spec.graph).map((n) => n.class_type))].sort()

const each = NON_DRAFT_WORKFLOWS.map((w) => [w.id, w] as const)

describe('the trial workflows: real graphs from the drafts [SPEC 14 1.41, 1.46 "Workflow data"]', () => {
  it.each(each)('%s: needs.nodeClasses is exactly the classes its graph uses', (_id, spec) => {
    expect([...spec.needs.nodeClasses].sort()).toEqual(sortedClasses(spec))
  })

  it.each(each)('%s: needs.models is exactly the files its loaders name', (_id, spec) => {
    const byName = (a: { file: unknown }, b: { file: unknown }) =>
      String(a.file).localeCompare(String(b.file))
    expect([...spec.needs.models].sort(byName)).toEqual(graphModels(spec).sort(byName))
  })

  it.each(each)('%s: says it is an agent draft never opened in ComfyUI', (_id, spec) => {
    expect(spec.status).toBe('trial')
    expect(spec.source.exportedFrom).toBe('agent draft, never opened in ComfyUI')
    expect(spec.source.changes.length).toBeGreaterThan(0)
  })
})

describe('moss-text-to-image as trial [comfy-workflows/moss-image-plain.json]', () => {
  it('is a trial with the slots of the notes: node 4 text, node 6 size, node 7 seed, node 9', () => {
    expect(mossTextToImage.status).toBe('trial')
    expect(mossTextToImage.slots).toEqual({
      prompt: { node: '4', input: 'text' },
      seed: [{ node: '7', input: 'seed' }],
      width: { node: '6', input: 'width' },
      height: { node: '6', input: 'height' },
      outputNode: '9',
    })
  })

  it('uses the real graph: EmptyFlux2LatentImage and the MOSS text encoder type', () => {
    expect(mossTextToImage.needs.nodeClasses).toEqual([
      'UNETLoader',
      'CLIPLoader',
      'VAELoader',
      'CLIPTextEncode',
      'EmptyFlux2LatentImage',
      'KSampler',
      'VAEDecode',
      'PreviewImage',
    ])
    expect(mossTextToImage.graph['2']?.inputs.type).toBe('moss_image')
    expect(mossTextToImage.model).toEqual(MOSS_MODEL)
  })

  it('runs at the first-run size and records the full size in source.changes', () => {
    expect(mossTextToImage.size).toBe(MOSS_FIRST_RUN_SIZE)
    expect(mossTextToImage.source.changes).toContain(
      'first-run size; full size is { multiple: 16, minPixels: 1000000, maxPixels: 2000000 }',
    )
    expect(mossTextToImage.source.template).toMatch(/image_moss_image_t2i\.json/)
  })

  it('bumps the version, since the graph file changed', () => {
    expect(mossTextToImage.version).toBe(2)
  })
})
