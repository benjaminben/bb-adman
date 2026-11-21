// GET /links/{projectId}/{campaignId}: the LinkState (spec/approvals-service.md "The keyed API").
// Built field by field and passed through its schema, so no picture address, password hash,
// salt, link ID or session can reach the reply.
import { LinkState } from '../contract'
import { listSignoffs } from '../db/signoffs'
import { listVariants } from '../db/variants'
import { apiError, apiJson } from './errors'
import { linkOf, timeText } from './link-of'
import type { ApiHandler } from './route'

export const readLink: ApiHandler = async (ctx) => {
  const link = await linkOf(ctx)
  if (link === null) return apiError(404, 'not_found')
  const db = ctx.env.DB
  const [variants, signoffs] = await Promise.all([
    listVariants(db, link.id),
    listSignoffs(db, link.id),
  ])
  const state = LinkState.parse({
    slug: link.slug,
    campaignName: link.campaignName,
    createdAt: timeText(link.createdAt),
    variants: variants.map((v) => ({
      variantKey: v.variantKey,
      version: v.version,
      pictureExpiresAt: timeText(v.pictureExpiresAt),
    })),
    signoffs: signoffs.map((s) => ({
      id: s.id,
      variantKey: s.variantKey,
      version: s.version,
      email: s.email,
      signedAt: timeText(s.createdAt),
    })),
  })
  return apiJson(state)
}
