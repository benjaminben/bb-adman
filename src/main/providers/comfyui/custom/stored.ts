// spec/comfyui-custom.md "The stored shape" (D-104), security class: one JSON file per added
// workflow, {userData}/comfy-workflows/{id}.json. The job, the video start, the slots and the
// node types are not stored: they are worked out from the graph's marks each time a file is
// read, by the file checks the add uses, so the marks are their one owner. Pure.
import { z } from 'zod'
import type { SizeRule } from '@/shared/comfy/fit-size'
import {
  CUSTOM_WORKFLOW_ID,
  isAllowedSize,
  isAllowedVideo,
  workflowNameSchema,
} from '@/shared/comfy/custom-workflow'
import type { CustomWorkflowId, WorkflowVideo } from '@/shared/schemas/queries/comfy'
import type { Graph } from '@/main/providers/comfyui/workflows/types'
import { checkWorkflowValue, type CheckedWorkflow } from './check-file'

export type StoredCustomWorkflow = {
  format: 1
  id: CustomWorkflowId
  name: string
  addedBy: 'user' | 'agent'
  // ISO 8601.
  addedAt: string
  // Null when the graph has no width and height marks.
  size: SizeRule | null
  // Set exactly when the job is video.
  video: WorkflowVideo | null
  // Per node only class_type, inputs and _meta.title are kept.
  graph: Graph
}

const whole = z.number().int()

const sizeSchema = z
  .object({ multiple: whole, minPixels: whole, maxPixels: whole })
  .strict()
  .refine(isAllowedSize)

const videoSchema = z
  .object({ fps: z.number(), maxMs: z.number(), frameStep: z.number(), frameOffset: z.number() })
  .strict()
  .refine(isAllowedVideo)

// The file as written. The graph is read by the file checks, not by this schema: a record
// parser would silently drop a __proto__ key that the checks must see and refuse.
export const storedCustomWorkflowSchema = z
  .object({
    format: z.literal(1),
    id: z
      .string()
      .regex(CUSTOM_WORKFLOW_ID)
      .transform((id) => id as CustomWorkflowId),
    name: workflowNameSchema,
    addedBy: z.enum(['user', 'agent']),
    addedAt: z.iso.datetime(),
    size: sizeSchema.nullable(),
    video: videoSchema.nullable(),
    graph: z.unknown(),
  })
  .strict()

export type StoredRead = { stored: StoredCustomWorkflow; checked: CheckedWorkflow }

// A parsed file that passes the schema, the file checks and the two rules that tie the
// stored values to the marks; else null. Nothing about a failure is returned.
export function readStoredWorkflow(value: unknown): StoredRead | null {
  const parsed = storedCustomWorkflowSchema.safeParse(value)
  if (!parsed.success) return null
  const check = checkWorkflowValue(parsed.data.graph)
  if (!check.ok) return null
  const checked = check.data
  const hasSize = checked.slots.width !== undefined
  const isVideo = checked.job === 'video'
  if (hasSize !== (parsed.data.size !== null) || isVideo !== (parsed.data.video !== null)) {
    return null
  }
  return { stored: { ...parsed.data, graph: checked.graph }, checked }
}
