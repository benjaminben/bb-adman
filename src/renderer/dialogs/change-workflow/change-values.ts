// The values of "Change workflow" (D-104) as the fields hold them, made from a workflow as
// comfy.getInfo lists it, and turned into the comfyWorkflow.update input on "Save". The
// command checks every value; a field left empty is sent as 0 and refused there.
import {
  MAX_MEGAPIXEL_OPTIONS,
  SIZE_MULTIPLES,
  sizeFromChoice,
} from '@/shared/comfy/custom-workflow'
import type { WorkflowInfo } from '@/shared/schemas/queries/comfy'
import type { comfyWorkflowUpdateInput } from '@/shared/schemas/commands/comfy-workflow'
import type { z } from 'zod'

export type ChangeValues = {
  name: string
  megapixels: string
  multiple: string
  fps: string
  seconds: string
  frameStep: string
  frameOffset: string
}

type UpdateInput = z.input<typeof comfyWorkflowUpdateInput>

// The size option whose largest size is the stored one.
function megapixelsOf(maxPixels: number): number {
  const found = MAX_MEGAPIXEL_OPTIONS.find(
    (option) => sizeFromChoice(SIZE_MULTIPLES[0], option).maxPixels === maxPixels,
  )
  return found ?? 1
}

export function startValues(w: WorkflowInfo): ChangeValues {
  const multiples: readonly number[] = SIZE_MULTIPLES
  return {
    name: w.label,
    megapixels: String(megapixelsOf(w.size.maxPixels)),
    multiple: String(multiples.includes(w.size.multiple) ? w.size.multiple : 16),
    fps: String(w.video?.fps ?? ''),
    seconds: String(w.video === undefined ? '' : w.video.maxMs / 1000),
    frameStep: String(w.video?.frameStep ?? ''),
    frameOffset: String(w.video?.frameOffset ?? ''),
  }
}

export function updateInput(
  w: WorkflowInfo,
  values: ChangeValues,
  sizeMarks: boolean,
): UpdateInput {
  const number = (text: string) => Number(text)
  return {
    workflowId: w.id,
    name: values.name,
    ...(sizeMarks && {
      size: { multiple: number(values.multiple), maxMegapixels: number(values.megapixels) },
    }),
    ...(w.job === 'video' && {
      video: {
        fps: number(values.fps),
        maxMs: number(values.seconds) * 1000,
        frameStep: number(values.frameStep),
        frameOffset: number(values.frameOffset),
      },
    }),
  }
}
