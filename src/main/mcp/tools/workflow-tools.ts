// The ComfyUI workflow tools (spec/comfyui-custom.md "MCP tools", D-104, CW-6a), security
// class. list runs comfyWorkflow.list (allow); add runs comfyWorkflow.add, which the user is
// asked about every time and which nothing answers but the user; remove runs
// comfyWorkflow.remove, asked as a delete. An agent never reads a graph back.
import {
  comfyWorkflowAddInput,
  comfyWorkflowRemoveInput,
} from '@/shared/schemas/commands/comfy-workflow'
import { comfyWorkflowListInput } from '@/shared/schemas/queries/comfy-workflow'
import type { ToolDef } from './table'
import { listedWorkflowFields, workflowIdOnly } from './workflow-replies'

export const WORKFLOW_TOOLS: readonly ToolDef[] = [
  {
    name: 'list_comfy_workflows',
    description:
      'List the ComfyUI workflows you may name in generate_images and generate_video: id, ' +
      'name, job (image, image_refs or video), start for a video (prompt, first_frame or ' +
      'references) and whether it is the default. For a video, start prompt means start ' +
      'none with use_references false; first_frame means start first_frame; references ' +
      'means start none with use_references true.',
    kind: 'query',
    target: 'comfyWorkflow.list',
    input: comfyWorkflowListInput,
    reply: listedWorkflowFields,
  },
  {
    name: 'add_comfy_workflow',
    description:
      "Add a ComfyUI workflow in API format (Export (API) in ComfyUI). Send the file's text " +
      'in workflow_json, at most 2 MB. Mark each step Adman fills by starting its title with ' +
      'adman: and a mark: prompt, seed, width, height, ref1 to ref8, first-frame, frames, ' +
      'output; name an input with =, as in adman: seed=noise_seed. The user is asked every ' +
      'time and sees the name, the job and every node type; you wait up to two minutes, and ' +
      "a refusal is final. Gives the new workflow's id. You cannot read a workflow back.",
    kind: 'command',
    target: 'comfyWorkflow.add',
    input: comfyWorkflowAddInput,
    reply: workflowIdOnly,
  },
  {
    name: 'remove_comfy_workflow',
    description:
      'Remove a workflow you or the user added. This cannot be undone. The user is asked in ' +
      'the app, and this call waits up to two minutes. A refusal is final.',
    kind: 'command',
    target: 'comfyWorkflow.remove',
    input: comfyWorkflowRemoveInput,
    reply: workflowIdOnly,
  },
]
