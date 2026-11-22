// P4-9 (spec/ai-jobs.md "Cut-out") [REQ: FR-307; OI-55]: the cut-out workflow, an agent draft,
// proven [D-103]. ComfyUI's built-in background removal, core nodes only. Node 3 gives
// the subject's mask; JoinImageWithAlpha stores 1 − mask as the alpha, so node 4 inverts it
// first and the subject stays solid while the background turns see-through. It takes one
// picture and no prompt, no seed and no size.
import type { WorkflowLicence } from '@/shared/schemas/queries/comfy'
import { MAX_PICTURE_PIXELS } from '@/main/providers/picture-limits'
import type { Graph, WorkflowSpec } from './types'
import { AGENT_DRAFT, LEAVES } from './common'
import graph from './birefnet-cutout.json'

const MAIN_FILE = 'birefnet.safetensors'

const BIREFNET_LICENCE: WorkflowLicence = {
  name: 'MIT',
  url: 'https://github.com/ZhengPeng7/BiRefNet',
  commercialNote: null,
}

export const birefnetCutout: WorkflowSpec = {
  id: 'birefnet-cutout',
  version: 1,
  label: 'BiRefNet: cut a picture out from its background',
  job: 'cutout',
  status: 'proven',
  model: { label: 'BiRefNet', mainFile: MAIN_FILE },
  graph: graph as Graph,
  slots: {
    seed: [],
    references: [
      { image: { node: '1', input: 'image' }, dropWhenUnused: { nodes: [], inputs: [] } },
    ],
    minReferences: 1,
    outputNode: '6',
  },
  needs: {
    // No number is published; the check's node list catches an old server.
    minComfyVersion: '0.0.0',
    checkedWith: '',
    models: [{ folder: 'background_removal', file: MAIN_FILE }],
    nodeClasses: [
      'LoadImage',
      'LoadBackgroundRemovalModel',
      'RemoveBackground',
      'InvertMask',
      'JoinImageWithAlpha',
      'PreviewImage',
    ],
    addOns: [],
  },
  // The type needs a value; no run reads it, since the graph has no size slot.
  size: { multiple: 1, minPixels: 1, maxPixels: MAX_PICTURE_PIXELS },
  licence: BIREFNET_LICENCE,
  leavesOnServer: [LEAVES.uploads, LEAVES.preview, LEAVES.record],
  source: {
    template: 'spec/ai-jobs.md "Cut-out", the six-node table',
    exportedFrom: AGENT_DRAFT,
    changes: [
      'InvertMask added between RemoveBackground and JoinImageWithAlpha, so the subject stays solid',
    ],
  },
}
