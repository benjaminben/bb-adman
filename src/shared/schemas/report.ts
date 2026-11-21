// The export report (spec/phases/phase-08.md "Report"; replaces the Report type of
// spec/export-and-checks.md). Strict at every level and bounded: report.get reads a body back
// from a project file, and a body that fails here is not trusted. The file holds the output
// folder's base name only (A-196); the report row keeps the full path.
import { z } from 'zod'
import { CheckGroup, CheckId, CheckStatus } from './checks'

// Generous bounds: they refuse a crafted body, never one the app built.
const MAX_ITEMS = 1000
const id = z.string().min(1).max(200)
const name = z.string().max(1000)
const message = z.string().max(2000)
const time = z.string().min(1).max(40)
const count = z.number().int().min(0)
const list = <T extends z.ZodTypeAny>(item: T) => z.array(item).max(MAX_ITEMS)

// The shape of CheckResult (src/shared/schemas/checks.ts). P8-13 adds the type test that the
// two are assignable both ways.
export const ReportCheck = z
  .object({
    checkId: CheckId,
    group: CheckGroup,
    status: CheckStatus,
    findings: list(z.object({ layerId: id.optional(), message }).strict()),
  })
  .strict()
export type ReportCheck = z.infer<typeof ReportCheck>

const ReportAsset = z
  .object({
    assetId: id,
    displayName: name,
    role: z.enum(['background', 'image', 'font', 'clip']),
    origin: z.enum(['generated', 'imported']),
    provider: id.optional(),
    model: name.optional(),
    // Cut to 2,000 characters in the HTML only (A-206).
    prompt: z.string().max(100_000).optional(),
  })
  .strict()

const ReportVariant = z
  .object({
    variantId: id,
    title: name,
    sizeLabel: name,
    language: id,
    format: z.enum(['image', 'video']),
    rev: count,
    // null on a first export (FR-238).
    changedSincePrevious: z.enum(['changed', 'unchanged', 'not_in_previous']).nullable(),
    subjects: list(z.object({ subjectId: id, displayName: name }).strict()),
    lastAgentChangeAt: time.nullable(),
    // null in the main language (FR-237).
    translations: list(
      z
        .object({
          layerKey: id,
          source: z.enum(['ai', 'agent', 'user', 'brief']).nullable(),
          status: z.enum(['missing', 'proposed', 'approved']).nullable(),
        })
        .strict(),
    ).nullable(),
    // Relative to the output folder.
    file: z.string().min(1).max(4096).nullable(),
    assets: list(ReportAsset),
    checks: list(ReportCheck),
    failure: message.nullable(),
  })
  .strict()
export type ReportVariant = z.infer<typeof ReportVariant>

export const Report = z
  .object({
    reportVersion: z.literal(1),
    campaignId: id,
    campaignName: name,
    createdAt: time,
    appVersion: id,
    outputFolderName: name,
    exportNumber: z.number().int().min(1),
    exporter: z.object({ name: name.nullable() }).strict(),
    market: name,
    audience: name,
    primaryLanguage: id,
    paidGenerations: z.object({ pictures: count, videos: count, text: count }).strict(),
    // false only before P8-13.
    checksRun: z.boolean(),
    proceeded: z
      .object({ by: name.nullable(), at: time, reason: message.nullable() })
      .strict()
      .nullable(),
    summary: z
      .object({ exported: count, passedAll: count, withWarnings: count, failed: count })
      .strict(),
    warningsExportedPast: list(
      z
        .object({ variantId: id, checkId: CheckId, message, seenBeforeExport: z.boolean() })
        .strict(),
    ),
    missing: list(
      z
        .object({
          sizeLabel: name,
          language: id,
          reason: z.enum(['no_variant', 'not_in_export', 'export_failed']),
        })
        .strict(),
    ),
    previousExport: z
      .object({ exportNumber: z.number().int().min(1), createdAt: time })
      .strict()
      .nullable(),
    variants: list(ReportVariant),
  })
  .strict()
export type Report = z.infer<typeof Report>
