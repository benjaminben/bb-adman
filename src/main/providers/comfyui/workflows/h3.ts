// The three MiniMax H3 workflows (SPEC 6.10.4, 6.10.7; 14 1.39: H3 needs 0.33.0, sound is
// kept). h3-text-to-video is a trial: its graph is the agent's draft
// comfy-workflows/h3-video-text.json, which the official template confirms (14 1.46). The
// other two are drafts: their graphs are stand-ins that only the tests use, never sent to a
// server, until real graphs arrive as data.
import type { Graph, WorkflowSpec, WorkflowSlots } from './types'
import {
  AGENT_DRAFT,
  DRAFT_SOURCE,
  H3_FIRST_RUN_SIZE,
  H3_FULL_SIZE,
  H3_LICENCE,
  H3_MAIN_FILE,
  H3_REF_FILE,
  H3_VIDEO,
  LEAVES,
  firstRunLine,
  h3Needs,
} from './common'
import textGraph from './h3-text-to-video.json'
import imageGraph from './h3-image-to-video.json'
import referenceGraph from './h3-reference-to-video.json'

const LOADERS = ['UNETLoader', 'CLIPLoader', 'VAELoader', 'CLIPTextEncode']
const MAKING = [
  'EmptyHunyuanLatentVideo',
  'KSampler',
  'VAEDecode',
  'VAEDecodeAudio',
  'CreateVideo',
  'SaveVideo',
]

const common = {
  version: 1,
  status: 'draft',
  job: 'video',
  size: H3_FULL_SIZE,
  video: H3_VIDEO,
  licence: H3_LICENCE,
} as const

const making: Omit<WorkflowSlots, 'prompt'> = {
  seed: [{ node: '8', input: 'seed' }],
  width: { node: '7', input: 'width' },
  height: { node: '7', input: 'height' },
  frames: { node: '7', input: 'length' },
  outputPrefix: { node: '12', input: 'filename_prefix' },
  outputNode: '12',
}

const model = (mainFile: string) => ({ label: 'MiniMax H3', mainFile })

export const h3TextToVideo: WorkflowSpec = {
  ...common,
  version: 2,
  status: 'trial',
  size: H3_FIRST_RUN_SIZE,
  id: 'h3-text-to-video',
  label: 'MiniMax H3: video from a prompt',
  videoStart: { firstFrame: false, references: false },
  model: model(H3_MAIN_FILE),
  graph: textGraph as Graph,
  // The "App fills" list of REFERENCE-NOTES.md: node 5 prompt, width, height, length;
  // node 6 noise_seed; node 14 filename_prefix.
  slots: {
    prompt: { node: '5', input: 'prompt' },
    seed: [{ node: '6', input: 'noise_seed' }],
    width: { node: '5', input: 'width' },
    height: { node: '5', input: 'height' },
    frames: { node: '5', input: 'length' },
    outputPrefix: { node: '14', input: 'filename_prefix' },
    outputNode: '14',
  },
  needs: h3Needs(H3_MAIN_FILE, [
    'UNETLoader',
    'CLIPLoader',
    'VAELoader',
    'MiniMaxH3ImageToVideo',
    'RandomNoise',
    'KSamplerSelect',
    'BasicScheduler',
    'BasicGuider',
    'SamplerCustomAdvanced',
    'VAEDecode',
    'VAEDecodeAudio',
    'CreateVideo',
    'SaveVideo',
  ]),
  leavesOnServer: [LEAVES.video, LEAVES.record],
  source: {
    template:
      'MiniMax H3 text to video, the official text-to-video template video_minimax_h3_t2v.json',
    exportedFrom: AGENT_DRAFT,
    changes: [
      'Flattened into plain nodes on the default path: 20 steps, no speed-up LoRA',
      'ResolutionSelector, ComfyMathExpression, PrimitiveFloat, PrimitiveBoolean, two ComfySwitchNode, two PrimitiveInt and LoraLoaderModelOnly left out',
      'Width, height and length are plain numbers the app fills, in place of the size and length nodes',
      'The save prefix is under adman/',
      firstRunLine(H3_FULL_SIZE),
    ],
  },
}

export const h3ImageToVideo: WorkflowSpec = {
  ...common,
  id: 'h3-image-to-video',
  label: 'MiniMax H3: video from a first frame',
  videoStart: { firstFrame: true, references: false },
  model: model(H3_MAIN_FILE),
  graph: imageGraph as Graph,
  slots: {
    prompt: { node: '5', input: 'text' },
    firstFrame: { node: '13', input: 'image' },
    ...making,
  },
  needs: h3Needs(H3_MAIN_FILE, [
    ...LOADERS,
    'LoadImage',
    'VAEEncode',
    'ReferenceLatent',
    ...MAKING,
  ]),
  leavesOnServer: [LEAVES.uploads, LEAVES.video, LEAVES.record],
  source: DRAFT_SOURCE('MiniMax H3 image to video'),
}

export const h3ReferenceToVideo: WorkflowSpec = {
  ...common,
  id: 'h3-reference-to-video',
  label: 'MiniMax H3: video from reference pictures',
  videoStart: { firstFrame: false, references: true },
  model: model(H3_REF_FILE),
  graph: referenceGraph as Graph,
  slots: {
    prompt: { node: '15', input: 'prompt' },
    references: [
      {
        image: { node: '13', input: 'image' },
        dropWhenUnused: { nodes: ['13'], inputs: [{ node: '15', input: 'image1' }] },
      },
      {
        image: { node: '14', input: 'image' },
        dropWhenUnused: { nodes: ['14'], inputs: [{ node: '15', input: 'image2' }] },
      },
    ],
    minReferences: 1,
    ...making,
  },
  needs: h3Needs(H3_REF_FILE, [...LOADERS, 'LoadImage', 'TextEncodeQwenImageEditPlus', ...MAKING]),
  leavesOnServer: [LEAVES.uploads, LEAVES.video, LEAVES.record],
  source: DRAFT_SOURCE('MiniMax H3 reference to video'),
}
