// approvals.refresh (spec/approvals-commands.md "approvals.refresh", security class): the
// network half, run in the command's prepare. Reads the link state; a gone link (404) is
// reported as such and nothing else runs; else the due picture addresses are renewed and the
// service's sign-offs are handed to run. The sign-offs passed the contract's schema in the
// client (a reply with a bad email is refused there as 'other'); run checks them again.
import type Database from 'better-sqlite3'
import type { CoreDeps } from '@/main/core-deps'
import type { ApprovalsClient } from './client'
import { readVariants, type Renewed, type SignoffRecord } from './local-store'
import { dueForRenewal, renewPictures } from './renew'

type Pair = { projectId: string; campaignId: string }

export type ReadBack =
  { gone: true } | { gone: false; signoffs: SignoffRecord[]; renewed: Renewed[] }

export async function readBack(
  deps: CoreDeps,
  db: Database.Database,
  client: ApprovalsClient,
  pair: Pair,
): Promise<ReadBack> {
  const state = await client.getLink(pair)
  if (state === null) return { gone: true }
  const rows = readVariants(db, pair.campaignId, deps.log)
  const due = dueForRenewal(rows, state.variants, deps.now())
  const renewed = await renewPictures(deps, client, pair, due)
  const signoffs = state.signoffs.map(({ variantKey, ...s }) => ({ ...s, variantId: variantKey }))
  return { gone: false, signoffs, renewed }
}
