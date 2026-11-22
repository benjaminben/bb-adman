// The video card's "Start from" choice (SPEC 14 1.60 CU-6b-R N-9, N-12 1-4): three starts on
// the fields generation.startVideo already takes (the start table of 1.60 CU-6b). A start is
// offered only when comfy.getInfo lists a video workflow for its pair; every provider other
// than ComfyUI takes the prompt start only (N-4).
import type { ComfyInfo, WorkflowInfo } from '@/shared/schemas/queries/comfy'

export type StartId = 'prompt' | 'first_frame' | 'reference'
type VideoStart = { firstFrame: boolean; references: boolean }

export const STARTS: ReadonlyArray<{ id: StartId; label: string; pair: VideoStart }> = [
  { id: 'prompt', label: 'A prompt', pair: { firstFrame: false, references: false } },
  {
    id: 'first_frame',
    label: 'A first-frame picture',
    pair: { firstFrame: true, references: false },
  },
  { id: 'reference', label: 'A reference picture', pair: { firstFrame: false, references: true } },
]

export const PICTURE_HINT = 'Tip: call the picture <Picture 1> in the prompt.'

const PROMPT_PAIR: VideoStart = { firstFrame: false, references: false }
const pairOf = (id: StartId): VideoStart => STARTS.find((s) => s.id === id)?.pair ?? PROMPT_PAIR

function workflowFor(info: ComfyInfo | null, pair: VideoStart): WorkflowInfo | undefined {
  return info?.workflows.find(
    (w) =>
      w.job === 'video' &&
      w.videoStart?.firstFrame === pair.firstFrame &&
      w.videoStart.references === pair.references &&
      w.video !== undefined,
  )
}

// The start's workflow's most, from comfy.getInfo.
export function maxMsFor(info: ComfyInfo | null, id: StartId): number | null {
  return workflowFor(info, pairOf(id))?.video?.maxMs ?? null
}

export function offeredStarts(info: ComfyInfo | null, providerId: string | undefined) {
  if (providerId !== 'comfyui') return STARTS.filter((s) => s.id === 'prompt')
  return STARTS.filter((s) => s.id === 'prompt' || workflowFor(info, s.pair) !== undefined)
}

// The start fields of the command input for a start and its one chosen picture.
export function startFields(id: StartId, pictureId: string | null) {
  const ids = id === 'prompt' || pictureId === null ? [] : [pictureId]
  return {
    start: id === 'first_frame' ? ('first_frame' as const) : ('none' as const),
    useReferences: id === 'reference',
    referenceAssetIds: ids,
  }
}
