// The warnings gate of export.run (spec/phases/phase-08.md "Export run"). ExportChecks.run gives
// each ad's results; every finding of each warn result is one warning, with the finding's own
// message (P8-7 matches on variant ID, check ID and message). Warnings stop the export unless
// the user chose to export anyway; the job gets the list it was shown.
import type { ProjectHandle } from '@/main/db/project-file'
import type { ExportChecks } from '@/main/export/types'
import { EXPORT_REASON_MESSAGES } from '@/shared/export/messages'
import type { ExportHasWarningsDetails, ExportWarning } from '@/shared/schemas/commands/export'
import type { ReportCheck } from '@/shared/schemas/report'
import { AppError } from '@/shared/schemas/result'

type Gate = { variantIds: string[]; proceedDespiteWarnings: boolean }

// In the order of the ads asked for, then the order of each ad's results.
function warningsOf(results: Map<string, ReportCheck[]>, variantIds: string[]) {
  const warned = variantIds.flatMap((variantId) =>
    (results.get(variantId) ?? [])
      .filter((check) => check.status === 'warn')
      .map((check) => ({ variantId, check })),
  )
  const warnings: ExportWarning[] = warned.flatMap(({ variantId, check }) =>
    check.findings.map((finding) => ({
      variantId,
      checkId: check.checkId,
      message: finding.message,
    })),
  )
  return { warned: warned.length > 0, warnings }
}

// The warnings the user was shown; refuses export_has_warnings when any check warns and the
// user did not choose to export anyway.
export async function warningsGate(
  checks: ExportChecks,
  project: ProjectHandle,
  gate: Gate,
): Promise<ExportWarning[]> {
  const results = await checks.run(project, gate.variantIds)
  const { warned, warnings } = warningsOf(results, gate.variantIds)
  if (warned && !gate.proceedDespiteWarnings) {
    const details: ExportHasWarningsDetails = { reason: 'export_has_warnings', warnings }
    throw new AppError('RULE_VIOLATION', EXPORT_REASON_MESSAGES.export_has_warnings, details)
  }
  return warnings
}
