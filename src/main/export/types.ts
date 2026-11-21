// The export run's shapes and ports (spec/phases/phase-08.md "Interfaces with other phases").
// P8-1 fixes them; each port's slice fills its own file and changes no shape here.
import type { ProjectHandle } from '@/main/db/project-file'
import type { JobRunContext } from '@/main/jobs/types'
import type { SceneInput } from '@/shared/scene/types'
import type { ExportWarning } from '@/shared/schemas/commands/export'
import type { ReportCheck } from '@/shared/schemas/report'

// What export.run hands its job, kept in memory only (A-195): the path never goes into the job
// row. root is the real path checkOutputDir gave; the typed path is not used again.
export type ExportPlan = {
  projectId: string
  campaignId: string
  root: string
  variantIds: string[]
  imageFormat: 'png' | 'jpg'
  jpgQuality: number
  fps: 30 | 60
  // The warnings the gate showed, so the job can mark one it did not see (A-204).
  warningsSeen: ExportWarning[]
  // Set when the user exported past warnings (FR-236). The reason is never logged.
  proceeded: { at: string; reason: string | null } | null
}

// The in-memory plan map, keyed by job ID (deps.export.plans).
export type ExportPlans = {
  set(jobId: string, plan: ExportPlan): void
  // The plan, removed from the map; null when there is none (a retried or crafted row).
  take(jobId: string): ExportPlan | null
  drop(jobId: string): void
}

// One ad's end, handed to the report port.
export type VariantOutcome = {
  variantId: string
  // The rev read when its draw started; null when it was not drawn.
  rev: number | null
  // Relative to the output folder; null when no file was written.
  file: string | null
  failure: string | null
  // The report's picture: JPEG, longest side 240 (A-203).
  picture: Uint8Array | null
}

// Phase 6's checks (P8-13 fills it). checksRun is false only in the stub.
export type ExportChecks = {
  readonly checksRun: boolean
  run(project: ProjectHandle, variantIds: string[]): Promise<Map<string, ReportCheck[]>>
  store(project: ProjectHandle, results: Map<string, ReportCheck[]>, ranBy: 'export'): void
}

// Every write under {root}/{campaignId}/ goes through this (P8-2, `exportTarget(root)`).
export type ExportTarget = {
  write(path: string, data: Uint8Array | ReadableStream): Promise<void>
  exists(path: string): Promise<boolean>
}

// One video ad (P8-16 fills it). Throws a failure with its sentence.
export type ExportVideo = {
  exportVariant(
    jc: JobRunContext,
    scene: SceneInput,
    plan: ExportPlan,
    target: ExportTarget,
    path: string,
  ): Promise<{ still: Uint8Array | null }>
}

// The report files and row (P8-9 fills it). Gives the report ID, or null when none was saved.
export type ExportReport = {
  write(
    jc: JobRunContext,
    plan: ExportPlan,
    target: ExportTarget,
    outcomes: VariantOutcome[],
    checks: Map<string, ReportCheck[]>,
  ): Promise<string | null>
}

// CoreDeps.exportPictures, filled in index.ts from nativeImage (P8-4).
export type ExportPictures = {
  toJpeg(png: Uint8Array, quality: number): Uint8Array
  // PNG out, of exactly `size`.
  stitch(
    parts: Array<{ x: number; y: number; png: Uint8Array }>,
    size: { width: number; height: number },
  ): Uint8Array
  // JPEG quality 80 out, longest side maxSide.
  shrink(png: Uint8Array, maxSide: number): Uint8Array
}

// CoreDeps.export.
export type ExportDeps = {
  plans: ExportPlans
  checks: ExportChecks
  video: ExportVideo
  report: ExportReport
}
