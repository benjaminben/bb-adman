// SPEC 4.2 "No address yet" and "Not offered", 14 1.41 "trial workflows are picked by the
// command" (security class): the ComfyUI checks of generation.startVideo, and of job.retry for
// a ComfyUI video job (14 1.53), made before a job row. The workflow must match the run's
// start pair (1.53, 1.60). A trial workflow only while the hand-test tools are on, for the
// user and an agent alike; a draft is never sent. D-104: a named workflow, or a custom one
// when no shipped one is offered. video-start-checks.ts calls these.
import type { ProjectContext } from '@/main/commands/types'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import type { VideoStart } from '@/main/providers/types'
import { AppError } from '@/shared/schemas/result'
import { chosenWorkflow, requireAddress, type ComfyCheckDeps } from './comfy-checks'

export const COMFY_VIDEO_NOT_OFFERED_MESSAGE = 'ComfyUI cannot make this kind of video yet.'

export function videoTooLongMessage(maxMs: number): string {
  return `ComfyUI makes clips of at most ${maxMs / 1000} seconds with this workflow.`
}

export const videoNotOffered = () =>
  new AppError('RULE_VIOLATION', COMFY_VIDEO_NOT_OFFERED_MESSAGE, {
    reason: 'comfy_job_not_offered',
  })

const PROMPT_ONLY: VideoStart = { firstFrame: false, references: false }

// [1.60] N-4 step 3: the workflow offered for the run's start pair, which it gives back.
export function checkComfyVideo(
  deps: ComfyCheckDeps,
  ctx: Pick<ProjectContext, 'actor'>,
  durationMs: number,
  videoStart: VideoStart = PROMPT_ONLY,
  workflowId?: string,
): WorkflowSpec {
  requireAddress(deps)
  const choice = { job: 'video' as const, videoStart }
  const spec = chosenWorkflow(deps, ctx, choice, workflowId, videoNotOffered)
  const maxMs = spec.video?.maxMs ?? 0
  if (durationMs > maxMs) {
    throw new AppError('RULE_VIOLATION', videoTooLongMessage(maxMs), {
      reason: 'video_too_long',
      maxMs,
    })
  }
  return spec
}
