// PUT .../gallery and PUT .../pictures (spec/approvals-service.md "The keyed API"). Every
// picture and clip address has passed checkPictureUrl (the routes' `check`) before a handler
// runs (spec/phases/round-2-approvals-video.md "Contract and data changes").
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
  const allowed = urls.every((url) => checkPictureUrl(url, env) !== null)
  return allowed ? null : { status: 400, code: 'invalid_input' }
}

// The cleaned address to write. The route's check has already refused any bad one, so a null
// here means the check was skipped: fail rather than store the raw text.
function cleaned(url: string, env: Env): string {
  const clean = checkPictureUrl(url, env)
  if (clean === null) throw new Error('unchecked picture address')
  return clean
}

export const checkGalleryPictures = (body: GalleryBody, env: Env) =>
  checkAll(
    body.variants.flatMap((v) =>
      v.clip === null ? [v.pictureUrl] : [v.pictureUrl, v.clip.clipUrl],
    ),
    env,
  )

export const checkRenewalPictures = (body: RenewalBody, env: Env) =>
  checkAll(
    body.pictures.flatMap((p) => (p.clipUrl === null ? [p.pictureUrl] : [p.pictureUrl, p.clipUrl])),
    env,
  )

// The four clip columns of a variant: an image, a video sent as its still only, or a video with
// its clip.
function clipColumns(v: GalleryBody['variants'][number], env: Env) {
  if (v.clip === null) return { kind: v.kind, clipUrl: null, clipMs: null, clipBytes: null }
  const { clipUrl, durationMs, bytes } = v.clip
  return { kind: v.kind, clipUrl: cleaned(clipUrl, env), clipMs: durationMs, clipBytes: bytes }
}

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
      pictureUrl: cleaned(v.pictureUrl, ctx.env),
      pictureExpiresAt: Date.parse(v.pictureExpiresAt),
      ...clipColumns(v, ctx.env),
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
        pictureUrl: cleaned(p.pictureUrl, ctx.env),
        pictureExpiresAt: Date.parse(p.pictureExpiresAt),
        clipUrl: p.clipUrl === null ? null : cleaned(p.clipUrl, ctx.env),
      }),
    ),
  )
  const renewed = new Set(
    pictures.filter((_p, i) => (results[i]?.meta.changes ?? 0) > 0).map((p) => p.variantKey),
  )
  return apiJson({ renewed: renewed.size })
}
