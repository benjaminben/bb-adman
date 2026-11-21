// The three MiniMax H3 workflows (SPEC 6.10.4, 6.10.7; 14 1.39: H3 needs 0.33.0, sound is
// kept). All three are trials, each graph an agent draft from comfy-workflows/ shipped as data.
// h3-text-to-video is the draft h3-video-text.json, which the official template confirms
// (14 1.46). h3-image-to-video is the first-frame draft (14 1.54 P-4 part 1).
// h3-reference-to-video is the reference draft h3-video-references.json (P-4 part 2).
import type { Graph, WorkflowSpec, WorkflowSlots } from './types'
import {
  AGENT_DRAFT,
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

const model = (mainFile: string) => ({ label: 'MiniMax H3', mainFile })

// The trial graphs' shared part: the "App fills" list of REFERENCE-NOTES.md, node 5 prompt,
// width, height, length; node 6 noise_seed; node 14 filename_prefix.
const TRIAL_SLOTS: WorkflowSlots = {
  prompt: { node: '5', input: 'prompt' },
  seed: [{ node: '6', input: 'noise_seed' }],
  width: { node: '5', input: 'width' },
  height: { node: '5', input: 'height' },
  frames: { node: '5', input: 'length' },
  outputPrefix: { node: '14', input: 'filename_prefix' },
  outputNode: '14',
}

// Every class of the trial graphs but node 5, the conditioning node.
const LOADERS = ['UNETLoader', 'CLIPLoader', 'VAELoader']
const MAKING = [
  'RandomNoise',
  'KSamplerSelect',
  'BasicScheduler',
  'BasicGuider',
  'SamplerCustomAdvanced',
  'VAEDecode',
  'VAEDecodeAudio',
  'CreateVideo',
  'SaveVideo',
]
const TRIAL_CLASSES = [...LOADERS, 'MiniMaxH3ImageToVideo', ...MAKING]

const trial = {
  version: 2,
  status: 'trial',
  job: 'video',
  size: H3_FIRST_RUN_SIZE,
  video: H3_VIDEO,
  licence: H3_LICENCE,
} as const

export const h3TextToVideo: WorkflowSpec = {
  ...trial,
  id: 'h3-text-to-video',
  label: 'MiniMax H3: video from a prompt',
  videoStart: { firstFrame: false, references: false },
  model: model(H3_MAIN_FILE),
  graph: textGraph as Graph,
  slots: TRIAL_SLOTS,
  needs: h3Needs(H3_MAIN_FILE, TRIAL_CLASSES),
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

// [1.54] P-4: a trial whose graph is the agent's draft comfy-workflows/h3-video-first-frame.json,
// the text graph with a LoadImage (node 15) into first_frame. Same model files as the text one.
export const h3ImageToVideo: WorkflowSpec = {
  ...trial,
  id: 'h3-image-to-video',
  label: 'MiniMax H3: video from a first frame',
  videoStart: { firstFrame: true, references: false },
  model: model(H3_MAIN_FILE),
  graph: imageGraph as Graph,
  slots: { ...TRIAL_SLOTS, firstFrame: { node: '15', input: 'image' } },
  needs: h3Needs(H3_MAIN_FILE, [...TRIAL_CLASSES, 'LoadImage']),
  leavesOnServer: [LEAVES.uploads, LEAVES.video, LEAVES.record],
  source: {
    template:
      'MiniMax H3 image to video, the first-frame template, through the agent draft h3-video-first-frame.json',
    exportedFrom: AGENT_DRAFT,
    changes: [
      'Taken from the draft as it is: the text graph with node 15 LoadImage into first_frame',
      'The first frame goes straight from LoadImage, as the template does; no resize node',
      'The save prefix is under adman/',
      firstRunLine(H3_FULL_SIZE),
    ],
  },
}

// [1.54] P-4 part 2: a trial whose graph is the agent's draft comfy-workflows/
// h3-video-references.json: the ref2va model, MiniMaxH3ReferenceToVideo with audio_vae, and
// two LoadImage nodes (15, 16) into ref_images. [1.59] L-16: one reference is declared, at
// most and at least, so only what ran is offered; node 16 and its key stay as data and every
// fill drops them. Two references wait for their own real run, with CU-6b.
export const h3ReferenceToVideo: WorkflowSpec = {
  ...trial,
  id: 'h3-reference-to-video',
  label: 'MiniMax H3: video from reference pictures',
  videoStart: { firstFrame: false, references: true },
  model: model(H3_REF_FILE),
  graph: referenceGraph as Graph,
  slots: {
    ...TRIAL_SLOTS,
    // The one reference is never unused.
    references: [
      { image: { node: '15', input: 'image' }, dropWhenUnused: { nodes: [], inputs: [] } },
    ],
    minReferences: 1,
    alwaysDrop: { nodes: ['16'], inputs: [{ node: '5', input: 'ref_images.ref_image_1' }] },
  },
  needs: h3Needs(H3_REF_FILE, [...LOADERS, 'LoadImage', 'MiniMaxH3ReferenceToVideo', ...MAKING]),
  leavesOnServer: [LEAVES.uploads, LEAVES.video, LEAVES.record],
  source: {
    template:
      'MiniMax H3 reference to video, the official two-reference template, through the agent draft h3-video-references.json',
    exportedFrom: AGENT_DRAFT,
    changes: [
      'Taken from the draft as it is: nodes 15 and 16 LoadImage into ref_images.ref_image_0 and ref_image_1',
      'The references go straight from LoadImage, with ref_image_size "match", as the template does',
      'One reference is declared (1.59 L-16): node 16 and its ref_images.ref_image_1 key are dropped on every fill',
      'The save prefix is under adman/',
      firstRunLine(H3_FULL_SIZE),
    ],
  },
}
