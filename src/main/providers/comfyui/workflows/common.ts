// The parts the shipped workflows share (SPEC 6.10.4, 6.10.5, 6.10.10): sizes, model files
// (analyst's V-17 and V-21), licences (V-24, V-25) and the "left on the server" sentences.
// Each value has this one owner.
import type { WorkflowLicence, WorkflowNeeds } from '../../../../shared/schemas/queries/comfy'
import type { SizeRule } from '../../../../shared/comfy/fit-size'

export const MOSS_SIZE: SizeRule = { multiple: 16, minPixels: 1_000_000, maxPixels: 2_000_000 }
export const H3_SIZE: SizeRule = { multiple: 32, minPixels: 589_824, maxPixels: 1_048_576 }

// Provisional until the trial (6.10.7, U): fps and the frame step are read from the template.
export const H3_VIDEO = { fps: 24, maxMs: 15_000, frameStep: 8 }

export const LEAVES = {
  uploads:
    "Reference pictures and first frames that Adman uploads stay in the server's input folder, under adman/.",
  preview: "Each picture leaves a file in the server's temporary folder until the server restarts.",
  video: "Each video run leaves a file in the server's output folder, under adman/.",
  record: 'The server keeps its own record of each run, the prompt included.',
} as const

// The four sentences in one fixed order, for comfy.getInfo's list.
export const LEAVES_ORDER: readonly string[] = Object.values(LEAVES)

export const MOSS_MODEL = {
  label: 'MOSS-Image',
  mainFile: 'moss_image_sft_int8_convrot.safetensors',
}

const MOSS_FILES = [
  { folder: 'diffusion_models', file: MOSS_MODEL.mainFile },
  { folder: 'text_encoders', file: 'qwen3.5_9b_w4a8_gptq.safetensors' },
  { folder: 'vae', file: 'flux2-vae_small.safetensors' },
]
const MOSS_EDIT_LORA = { folder: 'loras', file: 'moss_image_edit_lora_rank_64_bf16.safetensors' }

export const MOSS_LICENCE: WorkflowLicence = {
  name: 'Apache 2.0',
  url: 'https://huggingface.co/Comfy-Org/MOSS-Image',
  commercialNote: null,
}

export const H3_MAIN_FILE = 'minimax_h3_fl2va_pruned_int8_convrot.safetensors'
export const H3_REF_FILE = 'minimax_h3_ref2va_pruned_int8_convrot.safetensors'

const H3_SHARED_FILES = [
  { folder: 'text_encoders', file: 'qwen3vl_32b_minimax_h3_nvfp4_awq.safetensors' },
  { folder: 'vae', file: 'minimax_h3_video_vae_int8_convrot.safetensors' },
  { folder: 'vae', file: 'minimax_h3_audio_vae_fp32.safetensors' },
]

export const H3_LICENCE: WorkflowLicence = {
  name: 'MiniMax H3 Community License',
  url: 'https://comfy.org/minimax/license',
  commercialNote:
    'Commercial use of what this model makes may need a paid MiniMax licence, and in some regions the free licence does not cover it. Holding the licence is your responsibility. Read it at comfy.org/minimax/license.',
}

// A draft's graph is a stand-in: its node classes are the stand-in's, until a real graph
// arrives as data (SPEC 6.10.11, 14 "Workflow data").
function needs(
  minComfyVersion: string,
  models: WorkflowNeeds['models'],
  nodeClasses: string[],
): WorkflowNeeds {
  return { minComfyVersion, checkedWith: '', models, nodeClasses, addOns: [] }
}

export function mossNeeds(minComfyVersion: string, edit: boolean, nodeClasses: string[]) {
  return needs(minComfyVersion, edit ? [...MOSS_FILES, MOSS_EDIT_LORA] : MOSS_FILES, nodeClasses)
}

export function h3Needs(mainFile: string, nodeClasses: string[]) {
  const files = [{ folder: 'diffusion_models', file: mainFile }, ...H3_SHARED_FILES]
  return needs('0.33.0', files, nodeClasses)
}

export const DRAFT_SOURCE = (template: string) => ({
  template,
  exportedFrom: 'draft stand-in for the tests, not an export',
  changes: [],
})
