import { describe, it, expect } from 'vitest'
import {
  CUSTOM_WORKFLOW_REASONS,
  customWorkflowRefusal,
} from '@/shared/providers/custom-workflow-messages'

describe('the custom workflow refusal table [D-104]', () => {
  it('has one fixed sentence per reason, each a RULE_VIOLATION naming its reason', () => {
    expect(CUSTOM_WORKFLOW_REASONS).toHaveLength(20)
    for (const reason of CUSTOM_WORKFLOW_REASONS) {
      const body = customWorkflowRefusal(reason, 'prompt')
      expect(body.code).toBe('RULE_VIOLATION')
      expect(body.details).toEqual({ reason })
      expect(body.message).toMatch(/^[A-Z].*\.$/)
    }
  })

  it('fills {mark} with the mark word only', () => {
    expect(customWorkflowRefusal('workflow_mark_repeated', 'first-frame').message).toBe(
      'The first-frame mark is used more than once.',
    )
    expect(customWorkflowRefusal('workflow_mark_missing', 'seed').message).toBe(
      'This workflow has no seed mark. Add it to a step title in ComfyUI.',
    )
  })

  it('holds the sentences of the table', () => {
    expect(customWorkflowRefusal('workflow_too_large').message).toBe(
      'This file is larger than 2 MB. A ComfyUI workflow is much smaller.',
    )
    expect(customWorkflowRefusal('workflow_canvas_format').message).toBe(
      'This is a ComfyUI canvas file. In ComfyUI, choose Export (API) and add that file.',
    )
    expect(customWorkflowRefusal('workflow_add_in_settings').message).toBe(
      'Add a workflow in Settings.',
    )
  })
})
