// The three MOSS-Image workflows (SPEC 6.10.4). moss-text-to-image is proven [D-103]: its graph
// is the agent's draft comfy-workflows/moss-image-plain.json (14 1.41, 1.46 "Workflow data").
// The other two are drafts: their graphs are stand-ins that only the tests use, never sent to
// a server, until real graphs arrive as data.
import type { Graph, WorkflowSpec } from './types'
import {
  AGENT_DRAFT,
  DRAFT_SOURCE,
  LEAVES,
  MOSS_FIRST_RUN_SIZE,
  MOSS_FULL_SIZE,
  MOSS_LICENCE,
  MOSS_MODEL,
  firstRunLine,
  mossNeeds,
} from './common'
import textGraph from './moss-text-to-image.json' with { type: 'json' }
import editGraph from './moss-edit-references.json' with { type: 'json' }
import extendGraph from './moss-extend.json' with { type: 'json' }

const LOADERS = ['UNETLoader', 'CLIPLoader', 'VAELoader']
const SAMPLING = ['CLIPTextEncode', 'KSampler', 'VAEDecode', 'PreviewImage']

const common = {
  version: 1,
  status: 'draft',
  model: MOSS_MODEL,
  size: MOSS_FULL_SIZE,
  licence: MOSS_LICENCE,
} as const

export const mossTextToImage: WorkflowSpec = {
  ...common,
  version: 2,
  status: 'proven',
  size: MOSS_FIRST_RUN_SIZE,
  id: 'moss-text-to-image',
  label: 'MOSS-Image: picture from a prompt',
  job: 'image',
  graph: textGraph as Graph,
  // The "App fills" list of REFERENCE-NOTES.md: node 4 text; node 6 size; node 7 seed.
  slots: {
    prompt: { node: '4', input: 'text' },
    seed: [{ node: '7', input: 'seed' }],
    width: { node: '6', input: 'width' },
    height: { node: '6', input: 'height' },
    outputNode: '9',
  },
  needs: mossNeeds('0.42.0', false, [
    ...LOADERS,
    'CLIPTextEncode',
    'EmptyFlux2LatentImage',
    'KSampler',
    'VAEDecode',
    'PreviewImage',
  ]),
  leavesOnServer: [LEAVES.preview, LEAVES.record],
  source: {
    template: 'MOSS-Image text to image, official ComfyUI template image_moss_image_t2i.json',
    exportedFrom: AGENT_DRAFT,
    changes: [
      'Flattened into plain nodes on the default path: the prompt-rewriting step is off',
      'The optional skip-layer boost (SkipLayerGuidanceDiTSimple) is off, as the template has it by default',
      'The result node is PreviewImage, so nothing goes in the output folder',
      firstRunLine(MOSS_FULL_SIZE),
    ],
  },
}

export const mossEditReferences: WorkflowSpec = {
  ...common,
  id: 'moss-edit-references',
  label: 'MOSS-Image: picture from a prompt and reference pictures',
  job: 'image_refs',
  graph: editGraph as Graph,
  slots: {
    prompt: { node: '12', input: 'prompt' },
    seed: [{ node: '15', input: 'seed' }],
    width: { node: '14', input: 'width' },
    height: { node: '14', input: 'height' },
    // The first reference is the source photo, so it is never unused.
    references: [
      { image: { node: '10', input: 'image' }, dropWhenUnused: { nodes: [], inputs: [] } },
      {
        image: { node: '11', input: 'image' },
        dropWhenUnused: { nodes: ['11'], inputs: [{ node: '12', input: 'image2' }] },
      },
    ],
    minReferences: 1,
    outputNode: '17',
  },
  needs: mossNeeds('0.43.0', true, [
    ...LOADERS,
    'LoraLoaderModelOnly',
    'LoadImage',
    'TextEncodeQwenImageEditPlus',
    'EmptyLatentImage',
    ...SAMPLING,
  ]),
  leavesOnServer: [LEAVES.uploads, LEAVES.preview, LEAVES.record],
  source: DRAFT_SOURCE('MOSS-Image Image Edit'),
}

export const mossExtend: WorkflowSpec = {
  ...common,
  id: 'moss-extend',
  label: 'MOSS-Image: extend a background',
  job: 'extend',
  graph: extendGraph as Graph,
  slots: {
    prompt: { node: '14', input: 'text' },
    seed: [{ node: '16', input: 'seed' }],
    // The scaled picture size (SPEC 6.10.8).
    width: { node: '11', input: 'width' },
    height: { node: '11', input: 'height' },
    // The picture to extend, uploaded like a reference.
    references: [
      { image: { node: '10', input: 'image' }, dropWhenUnused: { nodes: [], inputs: [] } },
    ],
    minReferences: 1,
    pad: {
      left: { node: '12', input: 'left' },
      top: { node: '12', input: 'top' },
      right: { node: '12', input: 'right' },
      bottom: { node: '12', input: 'bottom' },
    },
    outputNode: '18',
  },
  needs: mossNeeds('0.43.0', true, [
    ...LOADERS,
    'LoraLoaderModelOnly',
    'LoadImage',
    'ImageScale',
    'ImagePadForOutpaint',
    'VAEEncodeForInpaint',
    ...SAMPLING,
  ]),
  leavesOnServer: [LEAVES.uploads, LEAVES.preview, LEAVES.record],
  source: DRAFT_SOURCE('none: no public way to extend with MOSS-Image was found (U-13)'),
}
