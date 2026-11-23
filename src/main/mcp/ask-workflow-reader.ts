// The broker's workflow reader (spec/comfyui-custom.md "The agent's ask", D-104, CW-6a),
// security class. Before an agent's comfyWorkflow.add reaches the screen, its input gets the
// command's own checks: the name cleaned and held to the name rule, the text through the file
// checks, video values only for a video graph. A refusal is the command's own fixed sentence,
// with no text from the file, and no event is sent. Nothing on disk is read.
// What passes is held in memory for the ask's life only: the cleaned name, the job, the start
// and the node types, read by the user-only query agent.askWorkflow. No event holds a node type.
import type { CustomJob, WorkflowStart } from '@/shared/comfy/custom-workflow'
import { jobWords, nodeTypeCount } from '@/shared/comfy/workflow-words'
import { comfyWorkflowAddInput } from '@/shared/schemas/commands/comfy-workflow'
import { AppError } from '@/shared/schemas/result'
import { checkWorkflowText, type CheckedWorkflow } from '@/main/providers/comfyui/custom/check-file'
import { cleanWorkflowName, requireVideoGraph } from '@/main/commands/comfy/workflow-update'
import type { CustomWorkflowStore } from '@/main/providers/comfyui/custom/store'

// The reply of agent.askWorkflow while the ask is open.
export type AskWorkflow = {
  name: string
  job: CustomJob
  start: WorkflowStart | null
  nodeTypes: string[]
}

export type HeldWorkflow = { view: AskWorkflow; references: number }

// The agent.askWorkflow reply: the view and the reference count, so the dialog builds the job
// words itself (CW-6b). A copy: the caller cannot change what the broker holds.
export type AskWorkflowReply = AskWorkflow & { references: number }

export function askWorkflowReply(held: HeldWorkflow): AskWorkflowReply {
  return { ...held.view, nodeTypes: [...held.view.nodeTypes], references: held.references }
}

function startOf(checked: CheckedWorkflow): WorkflowStart | null {
  if (checked.job !== 'video') return null
  if (checked.videoStart?.firstFrame) return 'first_frame'
  return checked.videoStart?.references ? 'references' : 'prompt'
}

// Throws the command's own refusal; the bus returns it as the reply.
// The store's own limit and name check runs on the cleaned name when the store is given.
export function readAskedWorkflow(
  input: unknown,
  workflows?: Pick<CustomWorkflowStore, 'checkAdd'>,
): HeldWorkflow {
  const parsed = comfyWorkflowAddInput.safeParse(input)
  if (!parsed.success) throw new AppError('INVALID_INPUT', 'Some values are not valid.')
  const name = cleanWorkflowName(parsed.data.name)
  workflows?.checkAdd(name)
  const check = checkWorkflowText(parsed.data.workflowJson)
  if (!check.ok) throw new AppError(check.error.code, check.error.message, check.error.details)
  if (parsed.data.video) requireVideoGraph(check.data)
  return {
    view: {
      name,
      job: check.data.job,
      start: startOf(check.data),
      nodeTypes: [...check.data.nodeTypes],
    },
    references: check.data.slots.references?.length ?? 0,
  }
}

// `Workflow "{name}": {job words}, {n} node types`. The name was cleaned by the reader.
export function workflowAddLine(held: HeldWorkflow): string {
  const { name, job, start, nodeTypes } = held.view
  return `Workflow "${name}": ${jobWords(job, start, held.references)}, ${nodeTypeCount(nodeTypes.length)}`
}
