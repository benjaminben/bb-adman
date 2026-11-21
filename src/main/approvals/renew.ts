// approvals.refresh step 3 (spec/approvals-commands.md "approvals.refresh", security class):
// keeps picture addresses fresh. A gallery row whose address runs out in less than 2 days, and
// whose published_rev is the version the service shows for it, has the same file signed again
// for 7 days; all of them go in one PUT .../pictures. A failure does not stop the refresh: it
// is logged by kind, nothing is renewed, and the next refresh tries again.
import type { CoreDeps } from '@/main/core-deps'
import { PICTURE_URL_MAX_SECONDS, picturePath } from '@/shared/approvals/picture-paths'
import type { ApprovalsClient, LinkStateReply } from './client'
import { ApprovalsFailure } from './failure'
import type { Renewed, VariantRecord } from './local-store'
import { logPictureStep } from './publish'

type Pair = { projectId: string; campaignId: string }

export const RENEW_WITHIN_MS = 2 * 24 * 60 * 60 * 1000

export function dueForRenewal(
  rows: VariantRecord[],
  shown: LinkStateReply['variants'],
  now: Date,
): VariantRecord[] {
  const versions = new Map(shown.map((v) => [v.variantKey, v.version]))
  return rows.filter(
    (r) =>
      Date.parse(r.expiresAt) - now.getTime() < RENEW_WITHIN_MS &&
      versions.get(r.variantId) === r.publishedRev,
  )
}

// The rows renewed on the service; none when there was nothing due or a step failed. A
// service that renewed fewer than were sent counts as a failure, so no expiry is recorded
// later than the service's own.
export async function renewPictures(
  deps: CoreDeps,
  client: ApprovalsClient,
  pair: Pair,
  due: VariantRecord[],
): Promise<Renewed[]> {
  if (due.length === 0) return []
  try {
    const store = deps.approvals.pictures()
    const pictures = []
    for (const r of due) {
      const file = picturePath(pair.projectId, pair.campaignId, r.variantId, r.publishedRev)
      const signed = await store.signedUrl(file, PICTURE_URL_MAX_SECONDS)
      pictures.push({
        variantKey: r.variantId,
        version: r.publishedRev,
        pictureUrl: signed.url,
        pictureExpiresAt: signed.expiresAt,
      })
    }
    const renewed = await client.renewPictures(pair, { pictures })
    if (renewed !== pictures.length) throw new ApprovalsFailure('other')
    return pictures.map((p) => ({
      variantId: p.variantKey,
      version: p.version,
      expiresAt: p.pictureExpiresAt,
    }))
  } catch (error) {
    logPictureStep(deps, pair, 'refreshRenew', error)
    return []
  }
}
