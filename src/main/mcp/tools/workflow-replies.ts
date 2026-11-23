// The reply pickers of the workflow tools (spec/comfyui-custom.md "MCP tools", D-104, CW-6a;
// rule 7). Named field by field, so nothing else the list or a command gives (a graph, a node,
// a file path, the address) can leave through MCP without a change here.
import type { ComfyWorkflowReply } from '@/shared/schemas/commands/comfy-workflow'
import type { ComfyWorkflowList } from '@/shared/schemas/queries/comfy-workflow'
import type { ReplyPicker } from './read-replies'

export const listedWorkflowFields: ReplyPicker = (data) => ({
  workflows: (data as ComfyWorkflowList).workflows.map((w) => ({
    id: w.id,
    name: w.name,
    job: w.job,
    start: w.start,
    isDefault: w.isDefault,
  })),
})

export const workflowIdOnly: ReplyPicker = (data) => ({
  workflowId: (data as ComfyWorkflowReply).workflowId,
})
