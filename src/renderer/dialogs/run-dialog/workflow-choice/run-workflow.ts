// CW-5 (spec/comfyui-custom.md, "Screens", the workflow picker): what the run dialog says and
// sends about the workflow. The cost line names the picked workflow, or on a retry "the same
// workflow as before"; the caller gets the workflow's ID only when the person could pick one.
import type { WorkflowId, WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { Result } from '@/shared/schemas/result'
import type { SummaryInput, VideoSent } from '@/renderer/dialogs/run-dialog/run-summary'

export type OnConfirm = (
  provider: string,
  count: number | null,
  video?: VideoSent,
  workflowId?: WorkflowId,
) => Promise<Result<unknown>>

// The ComfyUI part of the cost line.
export function comfyWords(
  address: string | null,
  workflow: WorkflowInfo | undefined,
  retry: boolean,
): SummaryInput['comfy'] {
  if (retry) return { address, label: '', retry: true }
  return workflow && { address, label: workflow.label }
}

// The arguments the caller gets: the video and the workflow only when there are some.
export function confirmWith(
  onConfirm: OnConfirm,
  provider: string,
  n: number | null,
  video: VideoSent | undefined,
  workflowId: WorkflowId | undefined,
) {
  if (workflowId !== undefined) return onConfirm(provider, n, video, workflowId)
  return video ? onConfirm(provider, n, video) : onConfirm(provider, n)
}
