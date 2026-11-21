// SPEC 4.2 "No address yet" and "Not offered", 14 1.41 "trial workflows are picked by the
// command" (security class): the ComfyUI checks of generation.startVideo, and of job.retry for
// a ComfyUI video job (14 1.53), made before a job row. CU-6a: only a video from a prompt
// alone, whose workflow must match that start pair (1.53). A trial workflow only for the user
// with the hand-test tools on; an agent never gets one, and a draft is never sent.
import type { CoreDeps } from '../../core-deps'
import type { ProjectContext } from '../types'
import { offeredWorkflow } from '../../providers/comfyui/workflows/offered'
import { reasonMessage } from '../../../shared/providers/messages'
import { AppError } from '../../../shared/schemas/result'

export const COMFY_VIDEO_NOT_OFFERED_MESSAGE = 'ComfyUI cannot make this kind of video yet.'

export function videoTooLongMessage(maxMs: number): string {
  return `ComfyUI makes clips of at most ${maxMs / 1000} seconds with this workflow.`
}

export const videoNotOffered = () =>
  new AppError('RULE_VIOLATION', COMFY_VIDEO_NOT_OFFERED_MESSAGE, {
    reason: 'comfy_job_not_offered',
  })

export function checkComfyVideo(
  deps: Pick<CoreDeps, 'devTools'> & { settings: Pick<CoreDeps['settings'], 'get'> },
  ctx: Pick<ProjectContext, 'actor'>,
  durationMs: number,
): void {
  if (deps.settings.get().comfyui.baseUrl === null) {
    throw new AppError('RULE_VIOLATION', reasonMessage('address_needed'), {
      reason: 'comfy_address_needed',
    })
  }
  const choice = { job: 'video' as const, videoStart: { firstFrame: false, references: false } }
  const spec = offeredWorkflow(choice, { devTools: deps.devTools, actor: ctx.actor })
  if (!spec) throw videoNotOffered()
  const maxMs = spec.video?.maxMs ?? 0
  if (durationMs > maxMs) {
    throw new AppError('RULE_VIOLATION', videoTooLongMessage(maxMs), {
      reason: 'video_too_long',
      maxMs,
    })
  }
}
