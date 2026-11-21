// report.list and report.get (spec/phases/phase-08.md "Report", queries). User only: the
// answers hold the output folder's full path (A-196).
import { z } from 'zod'
import { projectScoped } from '@/shared/schemas/commands/project-scoped'
import type { Report } from '@/shared/schemas/report'

const id = z.string().min(1).max(200)

export const reportListInput = projectScoped.extend({ campaignId: id }).strict()
export type ReportListInput = z.infer<typeof reportListInput>

// Newest first.
export type ReportListItem = {
  reportId: string
  createdAt: string
  exportNumber: number
  outputDir: string
  summary: Report['summary']
}
export type ReportListReply = ReportListItem[]

export const reportGetInput = projectScoped.extend({ reportId: id }).strict()
export type ReportGetInput = z.infer<typeof reportGetInput>
export type ReportGetReply = { report: Report; outputDir: string }
