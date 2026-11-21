// The in-memory plan map (spec/phases/phase-08.md "The output folder", A-195): export.run puts
// the plan here under its job ID and the job takes it once. Nothing here is written to disk.
import type { ExportPlan, ExportPlans } from './types'

export function createExportPlans(): ExportPlans {
  const plans = new Map<string, ExportPlan>()
  return {
    set(jobId, plan) {
      plans.set(jobId, plan)
    },
    take(jobId) {
      const plan = plans.get(jobId) ?? null
      plans.delete(jobId)
      return plan
    },
    drop(jobId) {
      plans.delete(jobId)
    },
  }
}
