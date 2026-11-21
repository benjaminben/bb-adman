// SPEC 3.6 "Jobs" [D-036]: each job kind runs in the background or is attached to the
// dialog or tab that started it. Frozen contract (SPEC 14, Phase 2 step 0).
export type JobClass = 'background' | 'attached'

export const JOB_KIND_CLASSES = {
  image_generation: 'background',
  video_generation: 'background',
  export: 'background',
  publish: 'background',
  cutout: 'background',
  generative_fill: 'attached',
  layout_proposal: 'attached',
  copy_options: 'attached',
  translation: 'attached',
  brief_extraction: 'attached',
} as const satisfies Record<string, JobClass>

export type JobKind = keyof typeof JOB_KIND_CLASSES
export const JOB_KINDS = Object.keys(JOB_KIND_CLASSES) as [JobKind, ...JobKind[]]

export const JOB_STATUSES = ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const
export type JobStatus = (typeof JOB_STATUSES)[number]

// How many jobs run at once for one provider (SPEC 3.6).
export const JOBS_AT_ONCE_PER_PROVIDER = 4
