// PUT .../gallery and PUT .../pictures (spec/approvals-service.md "The keyed API"). Every
// picture address has passed checkPictureUrl (the routes' `check`) before a handler runs.
import type { z } from 'zod'
import type { Gallery, PictureRenewals } from '../contract'
import type { Env } from '../env'
import { setCampaignName } from '../db/links'
import { clearGallery, deleteUnlistedSignoffs, putVariant, renewPicture } from '../db/variants'
import { checkPictureUrl } from '../pictures/check-url'
import { apiError, apiJson } from './errors'
import { linkOf } from './link-of'
import type { ApiHandler, Refusal } from './route'

type GalleryBody = z.output<typeof Gallery>
type RenewalBody = z.output<typeof PictureRenewals>

// One bad address refuses the whole request.
function checkAll(urls: string[], env: Env): Refusal | null {
  const allowed = urls.every((url) => checkPictureUrl(url, env))
  return allowed ? null : { status: 400, code: 'invalid_input' }
}

export const checkGalleryPictures = (body: GalleryBody, env: Env) =>
  checkAll(
    body.variants.map((v) => v.pictureUrl),
    env,
  )

export const checkRenewalPictures = (body: RenewalBody, env: Env) =>
  checkAll(
    body.pictures.map((p) => p.pictureUrl),
    env,
  )

// One batch: the name, then the gallery rows rewritten in list order, then the sign-offs of
// every variant no longer listed.
export const replaceGallery: ApiHandler<GalleryBody> = async (ctx) => {
  const link = await linkOf(ctx)
  if (link === null) return apiError(404, 'not_found')
  const db = ctx.env.DB
  const rows = ctx.body.variants.map((v, position) =>
    putVariant(db, link.id, {
      variantKey: v.variantKey,
      position,
      title: v.title,
      sizeLine: v.sizeLine,
      version: v.version,
      pictureUrl: v.pictureUrl,
      pictureExpiresAt: Date.parse(v.pictureExpiresAt),
    }),
  )
  await db.batch([
    setCampaignName(db, link.id, ctx.body.campaignName),
    clearGallery(db, link.id),
    ...rows,
    deleteUnlistedSignoffs(db, link.id),
  ])
  return apiJson({ variants: rows.length })
}

// Only rows whose variant and version both match are renewed and counted, each once.
export const renewPictures: ApiHandler<RenewalBody> = async (ctx) => {
  const link = await linkOf(ctx)
  if (link === null) return apiError(404, 'not_found')
  const db = ctx.env.DB
  const { pictures } = ctx.body
  const results = await db.batch(
    pictures.map((p) =>
      renewPicture(db, link.id, {
        variantKey: p.variantKey,
        version: p.version,
        pictureUrl: p.pictureUrl,
        pictureExpiresAt: Date.parse(p.pictureExpiresAt),
      }),
    ),
  )
  const renewed = new Set(
    pictures.filter((_p, i) => (results[i]?.meta.changes ?? 0) > 0).map((p) => p.variantKey),
  )
  return apiJson({ renewed: renewed.size })
}
