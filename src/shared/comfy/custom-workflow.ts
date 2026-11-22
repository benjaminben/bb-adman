// spec/comfyui-custom.md (D-104), security class: the ID form of a workflow a person or an
// agent added, the one schema every workflow ID input uses, and the limits, defaults and
// size options of the stored shape. Each value has this one owner.
import { z } from 'zod'
import type { SizeRule } from '@/shared/comfy/fit-size'
import {
  WORKFLOW_IDS,
  type CustomWorkflowId,
  type WorkflowId,
  type WorkflowVideo,
} from '@/shared/schemas/queries/comfy'

export const CUSTOM_WORKFLOW_ID = /^custom-[0-9a-f]{12}$/

export const isCustomWorkflowId = (id: string): id is CustomWorkflowId =>
  CUSTOM_WORKFLOW_ID.test(id)

const SHIPPED = new Set<string>(WORKFLOW_IDS)

// A shipped ID or the custom form, nothing else.
export const workflowIdSchema = z
  .string()
  .refine((id): id is WorkflowId => SHIPPED.has(id) || isCustomWorkflowId(id))

// The jobs a custom workflow can serve, and how a video starts.
export type CustomJob = 'image' | 'image_refs' | 'video'
export type WorkflowStart = 'prompt' | 'first_frame' | 'references'

export const MAX_CUSTOM_WORKFLOWS = 50
export const MAX_WORKFLOW_BYTES = 2 * 1024 * 1024
export const MAX_WORKFLOW_NODES = 500
export const MAX_WORKFLOW_NAME = 60

// A workflow's name: 1 to 60 characters, not only spaces, with no control, format or line
// break character. Uniqueness is the store's rule.
const NAME_REFUSED = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u
export const workflowNameSchema = z
  .string()
  .refine(
    (name) =>
      [...name].length <= MAX_WORKFLOW_NAME && name.trim() !== '' && !NAME_REFUSED.test(name),
  )

// One megapixel here is 2^20 pixels, as the defaults are.
const MEGAPIXEL = 1_048_576
export const SIZE_MULTIPLES = [8, 16, 32, 64] as const
export const MAX_MEGAPIXEL_OPTIONS = [0.25, 0.5, 1, 2, 4] as const

export const CUSTOM_SIZE_DEFAULTS: Readonly<Record<CustomJob, SizeRule>> = {
  image: { multiple: 16, minPixels: 838_861, maxPixels: 1_048_576 },
  image_refs: { multiple: 16, minPixels: 838_861, maxPixels: 1_048_576 },
  video: { multiple: 32, minPixels: 327_680, maxPixels: 409_600 },
}

export const CUSTOM_VIDEO_DEFAULT: WorkflowVideo = {
  fps: 24,
  maxMs: 5_000,
  frameStep: 4,
  frameOffset: 1,
}

export function sizeFromChoice(multiple: number, maxMegapixels: number): SizeRule {
  const multiples: readonly number[] = SIZE_MULTIPLES
  const options: readonly number[] = MAX_MEGAPIXEL_OPTIONS
  if (!multiples.includes(multiple) || !options.includes(maxMegapixels)) {
    throw new Error('Not a size option')
  }
  const maxPixels = maxMegapixels * MEGAPIXEL
  return { multiple, minPixels: Math.floor(maxPixels * 0.8), maxPixels }
}

const sameSize = (a: SizeRule, b: SizeRule) =>
  a.multiple === b.multiple && a.minPixels === b.minPixels && a.maxPixels === b.maxPixels

// A size from the options, or one of the defaults (the defaults are not all options).
export function isAllowedSize(rule: SizeRule): boolean {
  if (Object.values(CUSTOM_SIZE_DEFAULTS).some((d) => sameSize(d, rule))) return true
  const mp = rule.maxPixels / MEGAPIXEL
  return SIZE_MULTIPLES.some((multiple) =>
    MAX_MEGAPIXEL_OPTIONS.some(
      (option) => option === mp && sameSize(sizeFromChoice(multiple, option), rule),
    ),
  )
}

const within = (n: number, min: number, max: number) => Number.isInteger(n) && n >= min && n <= max

export function isAllowedVideo(v: WorkflowVideo): boolean {
  return (
    within(v.fps, 1, 60) &&
    within(v.maxMs / 1000, 1, 60) &&
    within(v.frameStep, 1, 64) &&
    within(v.frameOffset, 0, 64)
  )
}

// The mark words of a step title (spec/comfyui-custom.md, "Marks"), in the table's order.
export const MAX_REFERENCE_MARKS = 8
export const MARK_WORDS = [
  'prompt',
  'seed',
  'width',
  'height',
  'ref1',
  'ref2',
  'ref3',
  'ref4',
  'ref5',
  'ref6',
  'ref7',
  'ref8',
  'first-frame',
  'frames',
  'output',
] as const
export type MarkWord = (typeof MARK_WORDS)[number]
