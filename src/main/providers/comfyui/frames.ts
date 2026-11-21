// SPEC 6.10.7 "Length" and 14 1.45 B-6: the frame count of a video run. The nearest count the
// model accepts (frameStep x k + frameOffset, k a whole number from 0) to
// round(durationMs / 1000 x fps), never above the largest such count that fits maxMs.
import type { WorkflowVideo } from '../../../shared/schemas/queries/comfy'

export function frameCount(durationMs: number, video: WorkflowVideo): number {
  const { fps, frameStep, frameOffset, maxMs } = video
  const wanted = Math.round((durationMs / 1000) * fps)
  const most = Math.max(0, Math.floor(((maxMs / 1000) * fps - frameOffset) / frameStep))
  const nearest = Math.round((wanted - frameOffset) / frameStep)
  return frameStep * Math.min(most, Math.max(0, nearest)) + frameOffset
}
