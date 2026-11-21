// The link a keyed route acts on: found by the project and campaign IDs of its path
// (spec/approvals-service.md "The keyed API"), never by anything in the body.
import { findLinkByPair, type LinkRow } from '../db/links'
import type { ApiContext } from './route'

export async function linkOf<B>(ctx: ApiContext<B>): Promise<LinkRow | null> {
  if (ctx.link === null) return null
  return findLinkByPair(ctx.env.DB, ctx.link.projectId, ctx.link.campaignId)
}

// Times are kept as milliseconds and sent as ISO 8601 UTC text with milliseconds.
export const timeText = (ms: number) => new Date(ms).toISOString()
