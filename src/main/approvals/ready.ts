// The checks every approvals command makes before it contacts the service (spec/approvals.md
// "Commands", "Refusals every project-scope one shares"). The address and the key are read at
// the start of each command and never kept. Local HTTP is decided only by deps.devTools, the
// main process's own flag.
import type Database from 'better-sqlite3'
import type { CoreDeps } from '@/main/core-deps'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { requireCampaign } from '@/main/queries/campaign-reads'
import { parseApprovalsAddress } from '@/shared/approvals/address'
import { approvalsRefusal } from '@/shared/approvals/messages'
import type { ApprovalsService } from './client'

type ServiceDeps = Pick<CoreDeps, 'settings' | 'secrets' | 'devTools'>

// The saved origin, checked again, and the key; null when either is missing.
export function savedApprovalsService(deps: ServiceDeps): ApprovalsService | null {
  const saved = deps.settings.get().approvals.baseUrl
  const origin =
    saved === null ? null : parseApprovalsAddress(saved, { allowLocalHttp: deps.devTools })
  const key = deps.secrets.get('approvals.apiKey')
  return origin !== null && key !== undefined ? { origin, key } : null
}

// RULE_VIOLATION approvals_not_set_up when the address or the key is missing.
export function requireApprovalsService(deps: ServiceDeps): ApprovalsService {
  const service = savedApprovalsService(deps)
  if (service === null) throw approvalsRefusal('approvals_not_set_up')
  return service
}

export type ReadyOptions = {
  // createLink and publish: the S3 bucket and its keys are needed for the pictures.
  bucket: boolean
  // createLink needs no live link; the others need one.
  link: 'none' | 'live'
  // From the local tables (AP-8); asked last, so the refusals keep their order.
  linkIsLive: () => boolean
}

// The shared refusals, in the spec's order: unknown campaign, not set up, no bucket or S3 keys,
// then the link state. Gives the service to send to.
export function requireApprovalsReady(
  deps: ServiceDeps & Pick<CoreDeps, 'providers'>,
  db: Database.Database,
  campaignId: string,
  opts: ReadyOptions,
): ApprovalsService {
  requireCampaign(db, campaignId)
  const service = requireApprovalsService(deps)
  if (opts.bucket) {
    const s3 = deps.settings.get().storage.s3
    if (s3 === null || s3.bucket.trim() === '' || s3.region.trim() === '') {
      throw approvalsRefusal('approvals_needs_bucket')
    }
    requireProviderKeys(deps, 's3', 'share approval links')
  }
  const live = opts.linkIsLive()
  if (opts.link === 'none' && live) throw approvalsRefusal('approval_link_exists')
  if (opts.link === 'live' && !live) throw approvalsRefusal('approval_link_missing')
  return service
}
