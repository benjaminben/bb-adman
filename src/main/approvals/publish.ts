// approvals.publish, "Update gallery" (spec/approvals-commands.md "approvals.publish", security
// class): the network half, run in the command's prepare. All or nothing for the gallery
// (A-90): ask the service's health, draw the changed variants and make their clips (gallery-
// files.ts), sign every still and clip, replace the gallery; if any of those fails or the run
// is stopped, the files this run added to the folder, clips included, are removed and the
// command fails. After
// success, the campaign's folder keeps only the current stills and clips. Paths come only from
// picture-paths.ts; no signed address, key or path reaches a log line or an error.
import type Database from 'better-sqlite3'
import type { CoreDeps } from '@/main/core-deps'
import { readWireRows } from '@/main/db/rows'
import { directionsOf } from '@/main/queries/campaign-reads'
import { CampaignName, GALLERY_MAX, SizeLine, Title } from '@/shared/approvals/contract'
import { approvalsRefusal } from '@/shared/approvals/messages'
import {
  PICTURE_URL_MAX_SECONDS,
  pictureFolder,
  picturePath,
} from '@/shared/approvals/picture-paths'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { AppError } from '@/shared/schemas/result'
import { stopIfAsked } from './clip-step'
import { APPROVALS_REQUEST_REFUSED } from './failure'
import {
  galleryFiles,
  logPictureStep,
  storage,
  type GalleryEntry,
  type GalleryFiles,
  type PublishInput,
} from './gallery-files'
import type { VariantRecord } from './local-store'
import type { PictureStore } from './types'

type Pair = { projectId: string; campaignId: string }

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// The order campaign.get gives (src/main/queries/campaign.ts, as approvals.forCampaign repeats
// it): by the direction's order, the master first inside a direction, then createdAt, then ID.
export function campaignVariants(deps: Pick<CoreDeps, 'log'>, db: Database.Database, id: string) {
  const all = readWireRows(db, 'variant', deps.log) as VariantRow[]
  return directionsOf(db, id).flatMap((d) =>
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

const sizeLine = (v: VariantRow) => `${v.width}×${v.height} · ${v.language} · ${v.format}`

// Step 1 and the checks of every value before any draw or request: at most 500 variants, each
// ID fit for a picture path (else "Storage path refused"), the shown text the contract allows.
export function checkGallery(pair: Pair, campaignName: string, variants: VariantRow[]): void {
  if (variants.length > GALLERY_MAX) throw approvalsRefusal('too_many_variants')
  const shown = [CampaignName.safeParse(campaignName).success]
  for (const v of variants) {
    picturePath(pair.projectId, pair.campaignId, v.id, v.rev)
    shown.push(Title.safeParse(v.title).success, SizeLine.safeParse(sizeLine(v)).success)
  }
  if (shown.includes(false)) throw new AppError('INVALID_INPUT', APPROVALS_REQUEST_REFUSED)
}

export { logPictureStep }

async function removeQuietly(deps: CoreDeps, store: PictureStore, pair: Pair, paths: string[]) {
  try {
    await store.remove(paths)
  } catch (error) {
    logPictureStep(deps, pair, 'publishUndo', error)
  }
}

// Step 6: every file of the folder that is not a current picture.
async function removeOld(deps: CoreDeps, store: PictureStore, pair: Pair, keep: Set<string>) {
  try {
    const found = await store.list(pictureFolder(pair.projectId, pair.campaignId))
    await store.remove(found.filter((p) => !keep.has(p)))
  } catch (error) {
    logPictureStep(deps, pair, 'publishClean', error)
  }
}

export type { PublishInput }

// What the folder held before this run's first upload. A failing run removes only the paths it
// added, never a file the live gallery may already show (a path written again). When the folder
// cannot be listed, a failing run removes nothing; the next good run's clean-up does it.
async function listBefore(store: PictureStore, pair: Pair) {
  try {
    return new Set(await store.list(pictureFolder(pair.projectId, pair.campaignId)))
  } catch (error) {
    return { error }
  }
}

export type Published = { rows: VariantRecord[]; drawn: number; clips: number }

// One expiry covers a still and its clip, so the earlier of the two is sent and kept.
const earlier = (a: string, b: string | undefined) =>
  b !== undefined && Date.parse(b) < Date.parse(a) ? b : a

// Step 3 and 4 for one entry: both files signed, the local row and the gallery variant.
async function signed(store: PictureStore, e: GalleryEntry) {
  const still = await storage(() => store.signedUrl(e.file, PICTURE_URL_MAX_SECONDS))
  const clip =
    e.clip && (await storage(() => store.signedUrl(e.clip!.file, PICTURE_URL_MAX_SECONDS)))
  const expiresAt = earlier(still.expiresAt, clip?.expiresAt)
  const row: VariantRecord = {
    variantId: e.v.id,
    publishedRev: e.rev,
    expiresAt,
    clipMs: e.clip?.durationMs ?? null,
    clipBytes: e.clip?.bytes ?? null,
    clipMissing: e.missing,
  }
  const variant = {
    variantKey: e.v.id,
    title: e.v.title,
    sizeLine: sizeLine(e.v),
    version: e.rev,
    pictureUrl: still.url,
    pictureExpiresAt: expiresAt,
    kind: e.v.format,
    clip:
      e.clip && clip
        ? {
            clipUrl: clip.url,
            type: 'video/mp4' as const,
            durationMs: e.clip.durationMs,
            bytes: e.clip.bytes,
          }
        : null,
  }
  return { row, variant }
}

// Steps 0 and 2 to 6. Gives the rows run writes.
export async function publishGallery(deps: CoreDeps, input: PublishInput): Promise<Published> {
  const { pair } = input
  await input.client.health()
  const store = deps.approvals.pictures()
  const before = await listBefore(store, pair)
  const uploaded: string[] = []
  const rows: VariantRecord[] = []
  const keep = new Set<string>()
  let made: GalleryFiles
  try {
    made = await galleryFiles(deps, store, input, uploaded)
    const variants = []
    for (const e of made.entries) {
      const { row, variant } = await signed(store, e)
      rows.push(row)
      variants.push(variant)
      keep.add(e.file)
      if (e.clip) keep.add(e.clip.file)
    }
    stopIfAsked(input.signal)
    const shown = await input.client.replaceGallery(pair, {
      campaignName: input.campaignName,
      variants,
    })
    if (shown === null) throw approvalsRefusal('approval_link_gone')
  } catch (error) {
    if (before instanceof Set) {
      const added = uploaded.filter((p) => !before.has(p))
      if (added.length > 0) await removeQuietly(deps, store, pair, added)
    } else if (uploaded.length > 0) {
      logPictureStep(deps, pair, 'publishUndo', before.error)
    }
    throw error
  }
  await removeOld(deps, store, pair, keep)
  return { rows, drawn: made.drawn, clips: made.clips }
}
