// SPEC 4.2 "No address yet" and "Not offered", 14 1.41 "trial workflows are picked by the
// command" (security class): the ComfyUI checks of generation.startVideo, and of job.retry for
// a ComfyUI video job (14 1.53), made before a job row. The workflow must match the run's
// start pair (1.53, 1.60). A trial workflow only while the hand-test tools are on, for the
// user and an agent alike; a draft is never sent. video-start-checks.ts calls these.
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectContext } from '@/main/commands/types'
import { offeredWorkflow } from '@/main/providers/comfyui/workflows/offered'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'
import type { VideoStart } from '@/main/providers/types'
import { reasonMessage } from '@/shared/providers/messages'
import { AppError } from '@/shared/schemas/result'

export const COMFY_VIDEO_NOT_OFFERED_MESSAGE = 'ComfyUI cannot make this kind of video yet.'

export function videoTooLongMessage(maxMs: number): string {
  return `ComfyUI makes clips of at most ${maxMs / 1000} seconds with this workflow.`
}

export const videoNotOffered = () =>
  new AppError('RULE_VIOLATION', COMFY_VIDEO_NOT_OFFERED_MESSAGE, {
    reason: 'comfy_job_not_offered',
  })

type CheckDeps = Pick<CoreDeps, 'devTools'> & { settings: Pick<CoreDeps['settings'], 'get'> }

const PROMPT_ONLY: VideoStart = { firstFrame: false, references: false }

// [1.60] N-4 step 3: the workflow offered for the run's start pair, which it gives back.
export function checkComfyVideo(
  deps: CheckDeps,
  ctx: Pick<ProjectContext, 'actor'>,
  durationMs: number,
  videoStart: VideoStart = PROMPT_ONLY,
): WorkflowSpec {
  if (deps.settings.get().comfyui.baseUrl === null) {
    throw new AppError('RULE_VIOLATION', reasonMessage('address_needed'), {
      reason: 'comfy_address_needed',
    })
  }
  const choice = { job: 'video' as const, videoStart }
  const spec = offeredWorkflow(choice, { devTools: deps.devTools, actor: ctx.actor })
  if (!spec) throw videoNotOffered()
  const maxMs = spec.video?.maxMs ?? 0
  if (durationMs > maxMs) {
    throw new AppError('RULE_VIOLATION', videoTooLongMessage(maxMs), {
      reason: 'video_too_long',
      maxMs,
    })
  }
  return spec
}
