// The publish job kind (spec/phases/phase-09.md "Publishing"; body in src/main/publish/
// run-publish.ts). Security class full. The plan lives only in memory (publish-plans.ts): a row
// with no plan, or one that does not match it (a row from a crafted project file, a row left
// from an earlier run), fails with the fixed detail publish_not_started_here and touches
// nothing: no work folder, no storage. Storage calls never go through jc.call, so a publish
// adds no paid count.
import type { JobKindHandler, JobRunContext } from '@/main/jobs/types'
import { ProviderCancelled, ProviderFailure } from '@/main/providers/types'
import { publishPlans } from '@/main/publish/publish-plans'
import { runPublish, type PublishResult } from '@/main/publish/run-publish'
import type { JobRow } from '@/shared/schemas/rows/job'

const notStartedHere = () =>
  new ProviderFailure({ kind: 'other', detail: 'publish_not_started_here' })

async function runPublishJob(jc: JobRunContext, job: JobRow): Promise<PublishResult> {
  const plan = publishPlans(jc.deps).take(job.id)
  const matches =
    plan !== null &&
    plan.projectId === jc.projectId &&
    plan.campaignId === job.campaignId &&
    plan.storage === job.provider
  if (!plan || !matches) throw notStartedHere()
  const project = jc.deps.projects.get(jc.projectId)
  if (!project) throw new ProviderCancelled()
  return runPublish(jc, job.id, plan, project)
}

export function publishKind(): JobKindHandler {
  return { kind: 'publish', run: runPublishJob }
}
