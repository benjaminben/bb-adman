// The three MOSS-Image workflows (SPEC 6.10.4), as draft: their graphs are stand-ins that
// only the tests use, never sent to a server, until real graphs arrive as data.
import type { Graph, WorkflowSpec } from './types'
import { DRAFT_SOURCE, LEAVES, MOSS_FULL_SIZE, MOSS_LICENCE, MOSS_MODEL, mossNeeds } from './common'
import textGraph from './moss-text-to-image.json'
import editGraph from './moss-edit-references.json'
import extendGraph from './moss-extend.json'

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
  id: 'moss-text-to-image',
  label: 'MOSS-Image: picture from a prompt',
  job: 'image',
  graph: textGraph as Graph,
  slots: {
    prompt: { node: '4', input: 'text' },
    seed: [{ node: '7', input: 'seed' }],
    width: { node: '6', input: 'width' },
    height: { node: '6', input: 'height' },
    outputNode: '9',
  },
  needs: mossNeeds('0.42.0', false, [...LOADERS, 'EmptyLatentImage', ...SAMPLING]),
  leavesOnServer: [LEAVES.preview, LEAVES.record],
  source: DRAFT_SOURCE('MOSS-Image text to image'),
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
