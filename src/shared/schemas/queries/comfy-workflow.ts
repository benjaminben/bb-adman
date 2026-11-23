// comfyWorkflow.list (spec/comfyui-custom.md "Commands, queries and events", D-104), both
// actors: every workflow the caller may name for a picture or a video run. Never a graph, a
// node, a file path or the address.
import { z } from 'zod'
import type { CustomJob, WorkflowStart } from '@/shared/comfy/custom-workflow'
import type { WorkflowId } from './comfy'

export const comfyWorkflowListInput = z.object({}).strict()

export type ListedWorkflow = {
  id: WorkflowId
  name: string
  job: CustomJob
  // Null unless the job is video.
  start: WorkflowStart | null
  // The one a run of this job and start gets with no workflow named.
  isDefault: boolean
}

export type ComfyWorkflowList = { workflows: ListedWorkflow[] }
