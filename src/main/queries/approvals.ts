// approvals.forCampaign and approvals.getPassword (spec/approvals.md "Queries and the event").
// User only: an agent is refused before anything is read. The approvals rows come only through
// local-store.ts, which checks each one; the link address is built only from a slug that passed
// the contract's rule there, so a hostile project file cannot shape it.
import type Database from 'better-sqlite3'
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn, QueryOptions } from './types'
import { directionsOf, openFor, requireCampaign } from './campaign-reads'
import { readWireRows } from '@/main/db/rows'
import type { ActivityLog } from '@/main/log/activity-log'
import { readLink, readSignoffs, readVariants } from '@/main/approvals/local-store'
import { savedApprovalsService } from '@/main/approvals/ready'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { parseApprovalsAddress } from '@/shared/approvals/address'
import {
  approvalsForCampaignInput,
  approvalsGetPasswordInput,
  type ApprovalsForCampaign,
  type ApprovalsPassword,
  type ApprovalsReady,
  type ApprovalsVariant,
} from '@/shared/schemas/queries/approvals'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { AppError } from '@/shared/schemas/result'
import { APPROVALS_QUERY_DENIED } from '@/shared/approvals/messages'

export function requireUser(opts: QueryOptions): void {
  if (opts.actor !== 'user') throw new AppError('AGENT_DENIED', APPROVALS_QUERY_DENIED)
}

type ReadyDeps = Pick<CoreDeps, 'settings' | 'secrets' | 'devTools' | 'providers'>

function readyOf(deps: ReadyDeps): ApprovalsReady {
  if (savedApprovalsService(deps) === null) return 'no_service'
  const s3 = deps.settings.get().storage.s3
  if (s3 === null || s3.bucket.trim() === '' || s3.region.trim() === '') return 'no_bucket'
  try {
    requireProviderKeys(deps, 's3', 'share approval links')
  } catch (error) {
    if (error instanceof AppError && error.code === 'NEEDS_KEY') return 'no_bucket'
    throw error
  }
  return 'ready'
}

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// The order campaign.get gives (src/main/queries/campaign.ts): by the direction's order, the
// master first inside a direction, then createdAt, then ID.
function campaignVariants(db: Database.Database, campaignId: string, log: ActivityLog) {
  const all = readWireRows(db, 'variant', log) as VariantRow[]
  return directionsOf(db, campaignId).flatMap((d) =>
    all
      .filter((v) => v.directionId === d.id)
      .sort(
        (a, b) =>
          Number(b.id === d.masterVariantId) - Number(a.id === d.masterVariantId) ||
          a.createdAt.localeCompare(b.createdAt) ||
          byId(a.id, b.id),
      ),
  )
}

// R-10: only the sign-offs of the variant's current rev; older rows stay on disk, unshown.
function variantsOf(
  db: Database.Database,
  campaignId: string,
  log: ActivityLog,
): ApprovalsVariant[] {
  const published = new Map(readVariants(db, campaignId, log).map((v) => [v.variantId, v]))
  const signoffs = readSignoffs(db, campaignId, log)
  return campaignVariants(db, campaignId, log).map((v) => {
    const row = published.get(v.id)
    return {
      variantId: v.id,
      currentRev: v.rev,
      publishedRev: row?.publishedRev ?? null,
      stillOnly: row?.clipMissing ?? null,
      signoffs: signoffs
        .filter((s) => s.variantId === v.id && s.version === v.rev)
        .map((s) => ({ id: s.id, email: s.email, signedAt: s.signedAt, version: s.version })),
    }
  })
}

export function approvalsForCampaign(deps: CoreDeps): QueryFn {
  return (raw, opts): ApprovalsForCampaign => {
    requireUser(opts)
    const { input, project } = openFor(deps, approvalsForCampaignInput, raw)
    const db = project.db
    requireCampaign(db, input.campaignId)
    const saved = deps.settings.get().approvals.baseUrl
    const origin =
      saved === null ? null : parseApprovalsAddress(saved, { allowLocalHttp: deps.devTools })
    const link = readLink(db, input.campaignId, deps.log)
    return {
      ready: readyOf(deps),
      link:
        link === null
          ? null
          : {
              state: link.state,
              address: origin === null ? null : `${origin}/l/${link.slug}`,
              createdAt: link.createdAt,
              publishedAt: link.publishedAt,
              checkedAt: link.checkedAt,
              endedAt: link.endedAt,
              passwordKept:
                deps.approvals.passwords.read(input.projectId, input.campaignId) !== null,
            },
      variants: variantsOf(db, input.campaignId, deps.log),
    }
  }
}

export function approvalsGetPassword(deps: CoreDeps): QueryFn {
  return (raw, opts): ApprovalsPassword => {
    requireUser(opts)
    const { input } = openFor(deps, approvalsGetPasswordInput, raw)
    return { password: deps.approvals.passwords.read(input.projectId, input.campaignId) }
  }
}

export function approvalsQueries(deps: CoreDeps): Record<string, QueryFn> {
  return {
    'approvals.forCampaign': approvalsForCampaign(deps),
    'approvals.getPassword': approvalsGetPassword(deps),
  }
}
