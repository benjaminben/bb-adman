// spec/comfyui-custom.md "Commands, queries and events" (D-104), security class: the inputs
// and replies of the four comfyWorkflow commands. A workflow ID to change or remove must be
// the custom form; a shipped ID is INVALID_INPUT. The graph text is checked only for its
// size here: the file checks read it, so no refusal holds issues from parsing a graph.
import { z } from 'zod'
import {
  CUSTOM_WORKFLOW_ID,
  MAX_MEGAPIXEL_OPTIONS,
  MAX_WORKFLOW_BYTES,
  SIZE_MULTIPLES,
  isAllowedVideo,
} from '@/shared/comfy/custom-workflow'
import type { CustomWorkflowId } from '@/shared/schemas/queries/comfy'

const customIdSchema = z
  .string()
  .regex(CUSTOM_WORKFLOW_ID)
  .transform((id) => id as CustomWorkflowId)

const videoSchema = z
  .object({
    fps: z.number(),
    maxMs: z.number(),
    frameStep: z.number(),
    frameOffset: z.number(),
  })
  .strict()
  .refine(isAllowedVideo)

// The name as sent. The command cleans it with the shared name cleaner, then checks it with
// workflowNameSchema, so a name that cleans to nothing is INVALID_INPUT.
const sentName = z.string().max(1_000)

const oneOf = (options: readonly number[]) => z.number().refine((n) => options.includes(n))

export const comfyWorkflowAddFromFileInput = z
  .object({ filePath: z.string().min(1).max(4_096) })
  .strict()

// More UTF-16 units than the byte limit is always more bytes; the exact byte limit is the
// file checks' first step.
export const comfyWorkflowAddInput = z
  .object({
    name: sentName,
    workflowJson: z.string().max(MAX_WORKFLOW_BYTES),
    video: videoSchema.optional(),
  })
  .strict()

export const comfyWorkflowUpdateInput = z
  .object({
    workflowId: customIdSchema,
    name: sentName.optional(),
    size: z
      .object({ multiple: oneOf(SIZE_MULTIPLES), maxMegapixels: oneOf(MAX_MEGAPIXEL_OPTIONS) })
      .strict()
      .optional(),
    video: videoSchema.optional(),
  })
  .strict()

export const comfyWorkflowRemoveInput = z.object({ workflowId: customIdSchema }).strict()

export type ComfyWorkflowAddFromFileReply = { workflowId: CustomWorkflowId; name: string }
export type ComfyWorkflowReply = { workflowId: CustomWorkflowId }
