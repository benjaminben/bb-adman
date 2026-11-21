// export.run and report.add (spec/phases/phase-08.md "The output folder", "Export run",
// "Report"). Every input is strict and bounded. outputDir comes only from dialog.pickFolder; the
// command checks it again on disk (P8-2) before anything uses it.
import { z } from 'zod'
import { CheckId } from '@/shared/schemas/checks'
import { Report } from '@/shared/schemas/report'
import { projectScoped } from './project-scoped'

const id = z.string().min(1).max(200)
// At most 4,096 characters, the output folder rule's own limit.
const folderPath = z.string().min(1).max(4096)
// No control characters (Cc), new lines and tabs included.
export const noControlCharacters = (text: string) => /^\P{Cc}*$/u.test(text)
export const MAX_EXPORT_VARIANTS = 1000

const variantIds = z
  .array(id)
  .min(1)
  .max(MAX_EXPORT_VARIANTS)
  .refine((ids) => new Set(ids).size === ids.length, 'Each post may be named once.')

export const exportRunInput = projectScoped
  .extend({
    campaignId: id,
    variantIds,
    outputDir: folderPath,
    imageFormat: z.enum(['png', 'jpg']),
    jpgQuality: z.number().int().min(1).max(100),
    fps: z.union([z.literal(30), z.literal(60)]),
    proceedDespiteWarnings: z.boolean(),
    // FR-236: kept in the plan and the report, never in the job row or a log line.
    reason: z.string().trim().max(500).refine(noControlCharacters).optional(),
  })
  .strict()
export type ExportRunInput = z.infer<typeof exportRunInput>
export type ExportRunReply = { jobId: string }

// One warning the gate found.
export const ExportWarning = z
  .object({ variantId: id, checkId: CheckId, message: z.string().max(2000) })
  .strict()
export type ExportWarning = z.infer<typeof ExportWarning>

// details of the RULE_VIOLATION export_has_warnings, which the export dialog reads.
export const exportHasWarningsDetails = z
  .object({
    reason: z.literal('export_has_warnings'),
    warnings: z.array(ExportWarning).max(MAX_EXPORT_VARIANTS * 6),
  })
  .strict()
export type ExportHasWarningsDetails = z.infer<typeof exportHasWarningsDetails>

// report.add: internal, sent only by the export job. outputDir is the real root (the row keeps
// it; the report body holds its base name only).
export const reportAddInput = projectScoped
  .extend({ campaignId: id, outputDir: folderPath, report: Report })
  .strict()
export type ReportAddInput = z.infer<typeof reportAddInput>
export type ReportAddReply = { reportId: string }
