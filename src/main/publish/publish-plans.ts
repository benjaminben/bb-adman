// The publish plans in memory (spec/phases/phase-09.md "Publishing"; as export's A-195):
// publish.run puts the plan under its job ID and the job takes it once. The reason text for
// "publish anyway" lives only here, never in the job row or a log line. A publish row with no
// plan (one from a crafted project file, or left from an earlier run) is never published. One
// map per core, so two cores in one process never share plans.
import type { CoreDeps } from '@/main/core-deps'
import type { PublishStorageId } from '@/shared/schemas/commands/publish'

export type PublishPlan = {
  projectId: string
  campaignId: string
  storage: PublishStorageId
  replaceConfirmed: boolean
  proceedDespiteWarnings: boolean
  proceedReason: string | null
}

export type PublishPlans = {
  set(jobId: string, plan: PublishPlan): void
  take(jobId: string): PublishPlan | null
}

const byCore = new WeakMap<object, Map<string, PublishPlan>>()

export function publishPlans(deps: CoreDeps): PublishPlans {
  let plans = byCore.get(deps)
  if (!plans) {
    plans = new Map()
    byCore.set(deps, plans)
  }
  const map = plans
  return {
    set: (jobId, plan) => void map.set(jobId, plan),
    take(jobId) {
      const plan = map.get(jobId) ?? null
      map.delete(jobId)
      return plan
    },
  }
}
