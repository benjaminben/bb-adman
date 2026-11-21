// The export report (spec/phases/phase-08.md "Report"): the facts read from the project and
// each ad's end, made into one Report. Pure: no read, no clock.
import path from 'node:path'
import type { ExportPlan, VariantOutcome } from '@/main/export/types'
import type { ExportWarning } from '@/shared/schemas/commands/export'
import type { Report, ReportCheck, ReportVariant } from '@/shared/schemas/report'
import { changedSince } from './changed'
import { missingPairs } from './delivered'
import type { FactVariant, ReportFacts } from './facts'

// What the export run knows besides the facts. root is the real output folder: only its base
// name goes into the report (A-196).
export type ReportRun = {
  createdAt: string
  root: string
  checksRun: boolean
  checks: Map<string, ReportCheck[]>
  warningsSeen: ExportWarning[]
  proceeded: ExportPlan['proceeded']
}

const hasWarning = (checks: ReportCheck[]) => checks.some((c) => c.status === 'warn')

function reportVariant(
  facts: ReportFacts,
  fact: FactVariant,
  outcome: VariantOutcome,
  checks: ReportCheck[],
): ReportVariant {
  const rev = outcome.rev ?? fact.rev
  const names = new Map(facts.subjects.map((s) => [s.subjectId, s.displayName]))
  return {
    variantId: fact.id,
    title: fact.title,
    sizeLabel: fact.sizeLabel,
    language: fact.language,
    format: fact.format,
    rev,
    changedSincePrevious: changedSince(facts.previous, fact.id, rev),
    subjects: fact.subjectIds.map((id) => ({ subjectId: id, displayName: names.get(id) ?? id })),
    lastAgentChangeAt: fact.agentChangedAt,
    translations:
      fact.language === facts.campaign.primaryLanguage
        ? null
        : fact.textLayers.map((l) => ({
            layerKey: l.key,
            source: l.translationSource,
            status: l.translationStatus,
          })),
    file: outcome.file,
    assets: fact.assets,
    checks,
    failure: outcome.failure,
  }
}

// FR-231, FR-236, A-204: each finding of a warning on an ad that has a file.
function warningsPast(variants: ReportVariant[], seen: ExportWarning[]) {
  return variants.flatMap((v) =>
    v.file === null
      ? []
      : v.checks
          .filter((c) => c.status === 'warn')
          .flatMap((c) =>
            c.findings.map(({ message }) => ({
              variantId: v.variantId,
              checkId: c.checkId,
              message,
              seenBeforeExport: seen.some(
                (w) =>
                  w.variantId === v.variantId && w.checkId === c.checkId && w.message === message,
              ),
            })),
          ),
  )
}

// An outcome whose ad is not in the facts (deleted before the facts were read) has no title or
// size to show: it is left out of variants and counted as failed.
export function buildReport(
  facts: ReportFacts,
  outcomes: VariantOutcome[],
  run: ReportRun,
): Report {
  const byId = new Map(facts.variants.map((v) => [v.id, v]))
  const variants = outcomes.flatMap((o) => {
    const fact = byId.get(o.variantId)
    return fact ? [reportVariant(facts, fact, o, run.checks.get(o.variantId) ?? [])] : []
  })
  const exported = variants.filter((v) => v.file !== null)
  const name = facts.exporterName.trim() || null
  const { campaign, previous } = facts
  return {
    reportVersion: 1,
    campaignId: campaign.id,
    campaignName: campaign.name,
    createdAt: run.createdAt,
    appVersion: facts.appVersion,
    outputFolderName: path.basename(run.root),
    exportNumber: facts.reportCount + 1,
    exporter: { name },
    market: campaign.region,
    audience: campaign.audience,
    primaryLanguage: campaign.primaryLanguage,
    paidGenerations: { ...facts.paidCount },
    checksRun: run.checksRun,
    proceeded: run.proceeded && { by: name, at: run.proceeded.at, reason: run.proceeded.reason },
    summary: {
      exported: exported.length,
      passedAll: exported.filter((v) => !hasWarning(v.checks)).length,
      withWarnings: exported.filter((v) => hasWarning(v.checks)).length,
      failed: outcomes.length - exported.length,
    },
    warningsExportedPast: warningsPast(variants, run.warningsSeen),
    missing: missingPairs({
      sizeLabels: campaign.sizeLabels,
      languages: campaign.languages,
      variants: facts.variants.map((v) => ({
        variantId: v.id,
        sizeLabel: v.sizeLabel,
        language: v.language,
      })),
      chosen: outcomes.map((o) => o.variantId),
      withFile: exported.map((v) => v.variantId),
    }),
    previousExport: previous && {
      exportNumber: previous.exportNumber,
      createdAt: previous.createdAt,
    },
    variants,
  }
}
