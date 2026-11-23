// comfyWorkflow.update (spec/comfyui-custom.md "Commands, queries and events", D-104):
// the name, the size (only when the graph has size marks) and the video values (only for a
// video graph). The graph never changes. Agent policy deny.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { CheckedWorkflow } from '@/main/providers/comfyui/custom/check-file'
import { serverChecks } from '@/main/providers/comfyui/needs'
import { sizeFromChoice } from '@/shared/comfy/custom-workflow'
import {
  comfyWorkflowUpdateInput,
  type ComfyWorkflowReply,
} from '@/shared/schemas/commands/comfy-workflow'
import { AppError } from '@/shared/schemas/result'

export const WORKFLOW_NOT_HERE = 'That workflow is not on this computer.'
const NO_VIDEO = 'This workflow makes no video, so it takes no video values.'
const NO_SIZE = 'This workflow has no width and height marks, so it takes no size.'

export function requireVideoGraph(checked: CheckedWorkflow): void {
  if (checked.job !== 'video') throw new AppError('INVALID_INPUT', NO_VIDEO)
}

function requireSizeMarks(checked: CheckedWorkflow): void {
  if (checked.slots.width === undefined) throw new AppError('INVALID_INPUT', NO_SIZE)
}

export function comfyWorkflowUpdate(deps: Pick<CoreDeps, 'comfyWorkflows'>) {
  return defineCommand({
    name: 'comfyWorkflow.update',
    input: comfyWorkflowUpdateInput,
    changesAppState: true,
    run(_ctx, input) {
      const entry = deps.comfyWorkflows.get(input.workflowId)
      if (!entry) throw new AppError('NOT_FOUND', WORKFLOW_NOT_HERE)
      if (input.size) requireSizeMarks(entry.checked)
      if (input.video) requireVideoGraph(entry.checked)
      deps.comfyWorkflows.update(input.workflowId, {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.size && { size: sizeFromChoice(input.size.multiple, input.size.maxMegapixels) }),
        ...(input.video && { video: input.video }),
      })
      serverChecks.forget()
      const data: ComfyWorkflowReply = { workflowId: input.workflowId }
      return { data }
    },
  })
}
