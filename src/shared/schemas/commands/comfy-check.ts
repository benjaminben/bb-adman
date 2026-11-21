// comfy.check's reply (SPEC 4.2, 6.10.3; FR-252, FR-263, FR-266). Every name in a missing
// item comes from the app's own workflow file, never from the server's text, so the list
// can be shown, logged and given to an agent safely. The version is the server's own text,
// cut, and is shown only as text.
import { z } from 'zod'
import type { MissingItem } from '../queries/app'
import type { WorkflowId } from '../queries/comfy'

// comfy.check takes no input.
export const comfyCheckInput = z.object({}).strict()

export const COMFY_CHECK_OUTCOMES = [
  'ok',
  'no_answer',
  'not_comfyui',
  'sign_in_needed',
  'redirect_refused',
  'certificate',
  'address_refused',
] as const
export type ComfyCheckOutcome = (typeof COMFY_CHECK_OUTCOMES)[number]

export type ComfyCheck = {
  outcome: ComfyCheckOutcome
  // Only with outcome 'ok'.
  version?: string
  // A fixed sentence of the app's: the version could not be read, or is newer than the
  // one a workflow was checked with. A note, not a failure.
  note?: string
  // Empty unless the outcome is 'ok'; then one entry per shipped workflow.
  workflows: Array<{ id: WorkflowId; missing: MissingItem[] }>
}
