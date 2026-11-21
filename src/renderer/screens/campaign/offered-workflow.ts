// The workflow comfy.getInfo marks offered for the run a panel would start (spec/screens-
// campaign.md, "The trial mark in the panels"): pictures are `image` with no ticked reference
// and `image_refs` with one or more; a video also matches the chosen start's pair. Before
// comfy.getInfo answers, none.
import type { ComfyInfo, WorkflowInfo, WorkflowJob } from '@/shared/schemas/queries/comfy'

type VideoPair = NonNullable<WorkflowInfo['videoStart']>

export function offeredFor(
  info: ComfyInfo | null,
  job: WorkflowJob,
  pair?: VideoPair,
): WorkflowInfo | undefined {
  return info?.workflows.find(
    (w) =>
      w.offered &&
      w.job === job &&
      (pair === undefined ||
        (w.videoStart?.firstFrame === pair.firstFrame &&
          w.videoStart.references === pair.references)),
  )
}
