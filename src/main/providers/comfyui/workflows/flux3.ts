// The FLUX 3 klein reference workflow (SPEC 6.10.4 [1.46], 14 1.46 part B), proven [D-103]: its graph
// is the agent's draft comfy-workflows/flux3-klein-image-references.json, from the
// stakeholder's reference file. It takes one reference picture and has no size slot: the
// result takes the picture's shape at about 1 megapixel, so a run skips fitSize.
import type { WorkflowLicence } from '@/shared/schemas/queries/comfy'
import type { Graph, WorkflowSpec } from './types'
import { AGENT_DRAFT, LEAVES } from './common'
import graph from './flux3-klein-edit-references.json' with { type: 'json' }

const MAIN_FILE = 'flux3-image-klein-base-int8-convrot.safetensors'

// OI-76: the licence is not verified; the stakeholder flagged it for later.
const FLUX3_LICENCE: WorkflowLicence = {
  name: 'Not verified',
  url: '',
  commercialNote:
    'The licence of this model has not been checked. Commercial use may need a licence from its maker. Holding it is your responsibility.',
}

export const flux3KleinEditReferences: WorkflowSpec = {
  id: 'flux3-klein-edit-references',
  version: 1,
  label: 'FLUX 3 klein: picture from a prompt and one reference picture',
  job: 'image_refs',
  status: 'proven',
  model: { label: 'FLUX 3 klein', mainFile: MAIN_FILE },
  graph: graph as Graph,
  // The "App fills" list of REFERENCE-NOTES.md: node 6 text; node 9 seed; node 10 image.
  slots: {
    prompt: { node: '6', input: 'text' },
    seed: [{ node: '9', input: 'seed' }],
    references: [
      { image: { node: '10', input: 'image' }, dropWhenUnused: { nodes: [], inputs: [] } },
    ],
    minReferences: 1,
    outputNode: '15',
  },
  needs: {
    // No minimum is known: 0.45.0 saved the reference file, which is not a minimum (1.45 B-6).
    minComfyVersion: '0.0.0',
    checkedWith: '',
    models: [
      { folder: 'diffusion_models', file: MAIN_FILE },
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
  },
  // The type needs a value; no run reads it, since the graph sets the size.
  size: { multiple: 16, minPixels: 1_000_000, maxPixels: 1_000_000 },
  licence: FLUX3_LICENCE,
  leavesOnServer: [LEAVES.uploads, LEAVES.preview, LEAVES.record],
  source: {
    template: 'stakeholder reference file, Flux 3 klein image edit',
    exportedFrom: AGENT_DRAFT,
    // "Core nodes in the reference that the draft leaves out", REFERENCE-NOTES.md.
    changes: [
      'Flux3LayoutPrompt left out: it joins the typed prompt with boxes drawn in the canvas',
      'CreateBoundingBoxes left out: a canvas tool whose saved state is editor data',
      'TextGenerate left out: the prompt rewriter, marked deprecated; prompt rewriting is off',
      'The second CLIPLoader left out: only the rewriter needs it',
      "PrimitiveStringMultiline left out: the rewriter's system prompt",
      'BatchImagesNode left out: it gives the pictures to the rewriter',
      'ComfySwitchNode left out: rewriter on or off, flattened away',
      'Two PreviewAny left out: display only',
      'ImageCompare left out: display only',
      'EmptyFlux2LatentImage left out: it is not wired in the reference',
      'SaveImage swapped for PreviewImage',
    ],
  },
}
