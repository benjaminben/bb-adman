// deps.export (spec/phases/phase-08.md "Interfaces with other phases"): the plan map and the
// ports. core.ts builds it once. Each port comes from its own file, so the slices that fill
// them never edit this one.
import type { CoreDeps } from '@/main/core-deps'
import { createExportChecks } from './checks-port'
import { createExportPlans } from './plans'
import { createExportReport } from './report-port'
import type { ExportDeps } from './types'
import { createExportVideo } from './video-port'

// deps: the finished CoreDeps, read when a port runs.
export function createExportDeps(deps: () => CoreDeps): ExportDeps {
  return {
    plans: createExportPlans(),
    checks: createExportChecks(deps),
    video: createExportVideo(deps),
    report: createExportReport(deps),
  }
}
