// The workflow comfy.getInfo marks offered for the run a panel would start (spec/screens-
// campaign.md, "The trial mark in the panels"): pictures are `image` with no ticked reference
// and `image_refs` with one or more; a video also matches the chosen start's pair. Before
// comfy.getInfo answers, none. CW-5 (D-104): several may be offered once custom workflows are
// added, so this is the one marked `isDefault`, else the first offered one.
import type { ComfyInfo, WorkflowInfo, WorkflowJob } from '@/shared/schemas/queries/comfy'

type VideoPair = NonNullable<WorkflowInfo['videoStart']>

// Every workflow offered for the run, in comfy.getInfo order.
export function offeredList(
  info: ComfyInfo | null,
  job: WorkflowJob,
  pair?: VideoPair,
): WorkflowInfo[] {
  return (info?.workflows ?? []).filter(
    (w) =>
      w.offered &&
      w.job === job &&
      (pair === undefined ||
        (w.videoStart?.firstFrame === pair.firstFrame &&
          w.videoStart.references === pair.references)),
  )
}

export function offeredFor(
  info: ComfyInfo | null,
  job: WorkflowJob,
  pair?: VideoPair,
): WorkflowInfo | undefined {
  const offered = offeredList(info, job, pair)
  return offered.find((w) => w.isDefault) ?? offered[0]
}
