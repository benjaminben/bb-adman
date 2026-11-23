// comfyWorkflow.remove (spec/comfyui-custom.md "Commands, queries and events", D-104,
// security rule 10): deletes {userData}/comfy-workflows/{id}.json, the path built from an ID
// that passed CUSTOM_WORKFLOW_ID (the input schema), never from other text. Nothing on the
// server is touched.
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { serverChecks } from '@/main/providers/comfyui/needs'
import {
  comfyWorkflowRemoveInput,
  type ComfyWorkflowReply,
} from '@/shared/schemas/commands/comfy-workflow'
import { AppError } from '@/shared/schemas/result'
import { WORKFLOW_NOT_HERE } from './workflow-update'

export function comfyWorkflowRemove(deps: Pick<CoreDeps, 'comfyWorkflows'>) {
  return defineCommand({
    name: 'comfyWorkflow.remove',
    input: comfyWorkflowRemoveInput,
    changesAppState: true,
    run(_ctx, input) {
      if (!deps.comfyWorkflows.remove(input.workflowId)) {
        throw new AppError('NOT_FOUND', WORKFLOW_NOT_HERE)
      }
      serverChecks.forget()
      const data: ComfyWorkflowReply = { workflowId: input.workflowId }
      return { data }
    },
  })
}
