import { describe, it, expect } from 'vitest'
import {
  CUSTOM_WORKFLOW_REASONS,
  customWorkflowRefusal,
  type CustomWorkflowRefusal,
} from '@/shared/providers/custom-workflow-messages'

// Copied from spec/comfyui-custom.md, "The file checks", the refusal table.
const TABLE: Record<string, string> = {
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
}

const WITH_MARK = new Set(['workflow_mark_repeated', 'workflow_mark_missing'])

describe('the custom workflow refusal table [D-104]', () => {
  it('has exactly the 20 reasons of the spec table', () => {
    expect([...CUSTOM_WORKFLOW_REASONS].sort()).toEqual(Object.keys(TABLE).sort())
  })

  it.each(Object.entries(TABLE))(
    '%s is a RULE_VIOLATION with the table sentence',
    (reason, sentence) => {
      const refusal = (
        WITH_MARK.has(reason) ? { reason, mark: 'output' } : { reason }
      ) as CustomWorkflowRefusal
      expect(customWorkflowRefusal(refusal)).toEqual({
        code: 'RULE_VIOLATION',
        message: sentence.replace('{mark}', 'output'),
        details: { reason },
      })
    },
  )

  it('fills {mark} with the mark word only', () => {
    expect(
      customWorkflowRefusal({ reason: 'workflow_mark_repeated', mark: 'first-frame' }).message,
    ).toBe('The first-frame mark is used more than once.')
    expect(customWorkflowRefusal({ reason: 'workflow_mark_missing', mark: 'seed' }).message).toBe(
      'This workflow has no seed mark. Add it to a step title in ComfyUI.',
    )
  })
})
