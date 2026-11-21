// approvals.forCampaign and approvals.getPassword (spec/approvals.md "Queries and the event").
// User only: an agent is refused before anything is read. Stub (AP-5): the empty answers, after
// the input check, until AP-8 replaces the bodies.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn, QueryOptions } from './types'
import { openFor } from './campaign-reads'
import {
  approvalsForCampaignInput,
  approvalsGetPasswordInput,
  type ApprovalsForCampaign,
  type ApprovalsPassword,
} from '@/shared/schemas/queries/approvals'
import { AppError } from '@/shared/schemas/result'
import { APPROVALS_QUERY_DENIED } from '@/shared/approvals/messages'

export function requireUser(opts: QueryOptions): void {
  if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', APPROVALS_QUERY_DENIED)
}

export function approvalsForCampaign(deps: CoreDeps): QueryFn {
  return (raw, opts): ApprovalsForCampaign => {
    requireUser(opts)
    openFor(deps, approvalsForCampaignInput, raw)
    return { ready: 'no_service', link: null, variants: [] }
  }
}

export function approvalsGetPassword(deps: CoreDeps): QueryFn {
  return (raw, opts): ApprovalsPassword => {
    requireUser(opts)
    openFor(deps, approvalsGetPasswordInput, raw)
    return { password: null }
  }
}

export function approvalsQueries(deps: CoreDeps): Record<string, QueryFn> {
  return {
    'approvals.forCampaign': approvalsForCampaign(deps),
    'approvals.getPassword': approvalsGetPassword(deps),
  }
}
