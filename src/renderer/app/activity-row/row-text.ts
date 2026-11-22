// The words of an activity row (spec/screens-ai.md, "The activity panel", Row) [REQ: FR-217]:
// what the job is, where it belongs, when it started and its kind's icon. Kinds the spec does not word yet
// (export, publish, generative fill, translation) get their plain name.
import type { JobPlace } from '@/shared/schemas/queries/activity'
import type { JobRow } from '@/shared/schemas/rows/job'
import type { JobKind } from '@/shared/config/job-kinds'
import type { IconName } from '@/renderer/ui/icon'

const KIND_TEXT: Record<JobKind, string> = {
  image_generation: 'Pictures',
  video_generation: 'Video',
  export: 'Export',
  publish: 'Publish',
  cutout: 'Cut-out',
  generative_fill: 'Generative fill',
  layout_proposal: 'Text layout',
  copy_options: 'Copy options',
  translation: 'Translation',
  brief_extraction: 'Reading a brief',
}

// SH-4: the kind icon a row shows as its thumb.
export const KIND_ICON: Record<JobKind, IconName> = {
  image_generation: 'image',
  video_generation: 'film',
  export: 'export',
  publish: 'cloud',
  cutout: 'scissors',
  generative_fill: 'sparkle',
  layout_proposal: 'sparkle',
  copy_options: 'text',
  translation: 'globe',
  brief_extraction: 'book',
}

const COUNTED: ReadonlySet<JobKind> = new Set(['image_generation', 'copy_options'])

// The count the job's request asked for, when it holds one.
export function requestedCount(job: JobRow): number | null {
  const request = job.request as { count?: unknown } | null
  const count = typeof request === 'object' && request !== null ? request.count : undefined
  return typeof count === 'number' ? count : null
}

export function whatText(job: JobRow, providerLabel: string | null): string {
  const count = COUNTED.has(job.kind) ? requestedCount(job) : null
  const what = count === null ? KIND_TEXT[job.kind] : `${KIND_TEXT[job.kind]} (${count})`
  return providerLabel === null ? what : `${what} · ${providerLabel}`
}

const DELETED = '(deleted)'

// "{campaign} › {variant} › {layer}": a part the job has no ID for is left out; a part whose
// row is gone reads "(deleted)". A brief reading, or a job with no part, reads "Project".
export function whereText(job: JobRow, place: JobPlace): string {
  if (job.kind === 'brief_extraction') return 'Project'
  const parts = [
    [job.campaignId, place.campaignName],
    [job.variantId, place.variantLabel],
    [job.layerId, place.layerName],
  ] as const
  const shown = parts.filter(([id]) => id !== null).map(([, name]) => name ?? DELETED)
  return shown.length === 0 ? 'Project' : shown.join(' › ')
}

const two = (n: number) => String(n).padStart(2, '0')

// "{HH:MM}" in the computer's own time: when the job started.
export function timeText(createdAt: string): string {
  const at = new Date(createdAt)
  return `${two(at.getHours())}:${two(at.getMinutes())}`
}
