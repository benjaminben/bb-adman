// The second line of an added workflow's row (spec/comfyui-custom.md "Screens", D-104):
// "{job words} · {n} nodes", plus " · Added by an agent" when an agent added it. Only the job,
// the start, the reference count, the node count and who added it are read: no text from the
// graph.
import { jobWords } from '@/shared/comfy/workflow-words'
import type { WorkflowStart } from '@/shared/comfy/custom-workflow'
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import { plural } from '@/renderer/ui/plural'

function startOf(w: WorkflowInfo): WorkflowStart | null {
  if (w.videoStart === undefined) return null
  if (w.videoStart.firstFrame) return 'first_frame'
  return w.videoStart.references ? 'references' : 'prompt'
}

function jobLine(w: WorkflowInfo): string {
  const job = w.job === 'video' || w.job === 'image_refs' ? w.job : 'image'
  return jobWords(job, startOf(w), w.custom?.references ?? 0)
}

export function rowWords(w: WorkflowInfo): string {
  const parts = [jobLine(w), plural(w.custom?.nodeCount ?? 0, 'node')]
  if (w.custom?.addedBy === 'agent') parts.push('Added by an agent')
  return parts.join(' · ')
}
