// spec/comfyui-custom.md "The agent's ask", job words (D-104): the one owner of the words that
// say what a custom workflow makes. Settings, the ask and the picker use them.
import type { CustomJob, WorkflowStart } from '@/shared/comfy/custom-workflow'

const pictures = (n: number) => (n === 1 ? '1 reference picture' : `${n} reference pictures`)

export function jobWords(job: CustomJob, start: WorkflowStart | null, references: number): string {
  if (job === 'image') return 'Picture from a prompt'
  if (job === 'image_refs') return `Picture from a prompt and ${pictures(references)}`
  if (start === 'first_frame') return 'Video from a first frame'
  if (start === 'references') return `Video from ${pictures(references)}`
  return 'Video from a prompt'
}
