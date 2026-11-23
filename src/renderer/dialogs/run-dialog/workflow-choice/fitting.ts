// CW-5 (spec/comfyui-custom.md, "Screens", the workflow picker; "Which workflow a run gets",
// the remembered choice): the workflows that fit a ComfyUI run (offered, the same job and, for
// a video, the same start pair), in comfy.getInfo order; the words of each option (only its
// name, never text from its graph); and where the picker starts.
import { offeredList } from '@/renderer/screens/campaign/offered-workflow'
import type { VideoStartKind } from '@/shared/config/video-offers'
import type { ComfyInfo, WorkflowInfo, WorkflowJob } from '@/shared/schemas/queries/comfy'
import type { ChoiceKey } from '@/shared/schemas/settings'
import type { RunJob } from '../run-summary'

type VideoPair = NonNullable<WorkflowInfo['videoStart']>

const pair = (firstFrame: boolean, references: boolean): VideoPair => ({ firstFrame, references })

// What each kind of run needs from a workflow.
const NEEDS: Record<ChoiceKey, { job: WorkflowJob; pair?: VideoPair }> = {
  image: { job: 'image' },
  image_refs: { job: 'image_refs' },
  video_prompt: { job: 'video', pair: pair(false, false) },
  video_first_frame: { job: 'video', pair: pair(true, false) },
  video_references: { job: 'video', pair: pair(false, true) },
}

const VIDEO_KEYS: Partial<Record<VideoStartKind, ChoiceKey>> = {
  prompt: 'video_prompt',
  first_frame: 'video_first_frame',
  reference: 'video_references',
}

// The kind of run, as the remembered choice keys it. A cut-out, a layout, a text run and a
// video from the background have none.
export function choiceKey(
  job: RunJob,
  referenceCount: number,
  start?: VideoStartKind,
): ChoiceKey | null {
  if (job === 'image') return referenceCount > 0 ? 'image_refs' : 'image'
  if (job !== 'video') return null
  return VIDEO_KEYS[start ?? 'prompt'] ?? null
}

export function fittingWorkflows(info: ComfyInfo | null, key: ChoiceKey | null): WorkflowInfo[] {
  if (key === null) return []
  return offeredList(info, NEEDS[key].job, NEEDS[key].pair)
}

export function optionWords(workflow: WorkflowInfo): string {
  const agent = workflow.custom?.addedBy === 'agent'
  return agent ? `${workflow.label} (added by an agent)` : workflow.label
}

// The remembered workflow when it still fits, else the default.
export function startWorkflow(
  fitting: WorkflowInfo[],
  remembered: string | undefined,
): WorkflowInfo | undefined {
  return fitting.find((w) => w.id === remembered) ?? fitting.find((w) => w.isDefault) ?? fitting[0]
}
