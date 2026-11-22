// spec/comfyui-custom.md "The file checks" (D-104), security class: the one copy of the
// refusal sentences for a workflow a person or an agent adds. Every sentence is fixed and
// never holds text from the file; `{mark}` is filled only with a word of the marks table.
import type { MarkWord } from '@/shared/comfy/custom-workflow'
import type { ErrorBody } from '@/shared/schemas/result'

const SENTENCES = {
  workflow_too_large: 'This file is larger than 2 MB. A ComfyUI workflow is much smaller.',
  workflow_not_json: 'This file is not a ComfyUI workflow.',
  workflow_canvas_format:
    'This is a ComfyUI canvas file. In ComfyUI, choose Export (API) and add that file.',
  workflow_bad_shape: 'This file is not a ComfyUI workflow in API format.',
  workflow_too_many_nodes: 'This workflow has more than 500 nodes. Adman takes at most 500.',
  workflow_bad_link: 'A node in this workflow links to a node that is not there.',
  workflow_unknown_mark: 'A step title starts with adman: but holds a mark Adman does not know.',
  workflow_mark_no_input:
    'A marked step has no input Adman can fill. Name the input in the title, for example adman: seed=noise_seed.',
  workflow_mark_shared: 'Two marks point at the same input.',
  workflow_mark_repeated: 'The {mark} mark is used more than once.',
  workflow_mark_missing: 'This workflow has no {mark} mark. Add it to a step title in ComfyUI.',
  workflow_size_marks: 'Mark both width and height, or neither.',
  workflow_ref_gap: 'Reference marks must be numbered from ref1 with no gap.',
  workflow_first_frame_needs_frames:
    'A workflow with a first frame must also mark its frame count.',
  workflow_job_not_offered:
    'Adman cannot run a workflow with both a first frame and reference pictures yet.',
  workflow_limit: 'You can add at most 50 workflows. Remove one first.',
  workflow_name_taken: 'A workflow with that name already exists.',
  workflow_file_unreadable: 'Adman could not read that file.',
  workflow_not_picked: 'Choose the file again.',
  workflow_add_in_settings: 'Add a workflow in Settings.',
} as const

export type CustomWorkflowReason = keyof typeof SENTENCES

export const CUSTOM_WORKFLOW_REASONS = Object.keys(SENTENCES) as CustomWorkflowReason[]

// The two sentences that name a mark take one; no other sentence does.
type MarkReason = 'workflow_mark_repeated' | 'workflow_mark_missing'
export type CustomWorkflowRefusal =
  { reason: Exclude<CustomWorkflowReason, MarkReason> } | { reason: MarkReason; mark: MarkWord }

export function customWorkflowRefusal(refusal: CustomWorkflowRefusal): ErrorBody {
  const { reason } = refusal
  const sentence = SENTENCES[reason]
  const message = 'mark' in refusal ? sentence.replace('{mark}', refusal.mark) : sentence
  return { code: 'RULE_VIOLATION', message, details: { reason } }
}
