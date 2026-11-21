// approvals.publish, "Update gallery" (spec/approvals-commands.md "approvals.publish", security
// class): the network half, run in the command's prepare. All or nothing for the gallery
// (A-90): draw the changed variants, upload them, sign every picture, replace the gallery; if
// any of those fails, this run's files are removed and the command fails. After success, the
// campaign's folder keeps only the current pictures. Paths come only from picture-paths.ts;
// no signed address, key or path reaches a log line or an error.
import type Database from 'better-sqlite3'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRows } from '@/main/db/rows'
import { directionsOf } from '@/main/queries/campaign-reads'
import { ProviderFailure } from '@/main/providers/types'
import { plainMessage } from '@/main/providers/messages'
import { CampaignName, GALLERY_MAX, SizeLine, Title } from '@/shared/approvals/contract'
import { approvalsRefusal, renderFailedMessage } from '@/shared/approvals/messages'
import {
  PICTURE_URL_MAX_SECONDS,
  pictureFolder,
  picturePath,
} from '@/shared/approvals/picture-paths'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { AppError } from '@/shared/schemas/result'
import type { ApprovalsClient } from './client'
import { APPROVALS_REQUEST_REFUSED } from './failure'
import type { VariantRecord } from './local-store'
import type { PictureStore } from './types'

type Pair = { projectId: string; campaignId: string }

export const PICTURE_SIDE = 1600

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

// A storage failure: PROVIDER_ERROR with the provider's own sentence for its kind.
async function storage<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    if (!(error instanceof ProviderFailure)) throw error
    const { kind } = error.error
    throw new AppError('PROVIDER_ERROR', plainMessage(kind, 'Amazon S3'), { provider: 's3', kind })
  }
}

function kindOf(error: unknown): string {
  if (error instanceof ProviderFailure) return error.error.kind
  if (error instanceof AppError) return error.code
  return 'other'
}

// One warn line for a picture step that may fail without failing the command: IDs and the
// error kind only.
export function logPictureStep(
  deps: Pick<CoreDeps, 'log'>,
  pair: Pair,
  step: string,
  error: unknown,
) {
  deps.log.write({
    level: 'warn',
    event: 'provider',
    name: 'approvals.pictures',
    actor: 'system',
    ok: false,
    projectId: pair.projectId,
    campaignId: pair.campaignId,
    errorKind: kindOf(error),
    message: 'A step with the approval pictures could not be finished.',
    context: { step },
  })
}

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

export type PublishInput = {
  project: ProjectHandle
  pair: Pair
  client: ApprovalsClient
  campaignName: string
  variants: VariantRow[]
  // published_rev by variant ID, from the local gallery rows.
  published: Map<string, number>
}

export type Published = { rows: VariantRecord[]; drawn: number }

async function drawAndUpload(
  deps: CoreDeps,
  store: PictureStore,
  input: PublishInput,
  v: VariantRow,
) {
  const drawn = await deps.render.render(input.project, v.id, PICTURE_SIDE).catch(() => {
    throw new AppError('RULE_VIOLATION', renderFailedMessage(v.title), {
      reason: 'render_failed',
      variantId: v.id,
    })
  })
  const file = picturePath(input.pair.projectId, input.pair.campaignId, v.id, drawn.rev)
  await storage(() => store.put(file, drawn.png))
  return { file, rev: drawn.rev }
}

// Steps 2 to 6. Gives the rows run writes.
export async function publishGallery(deps: CoreDeps, input: PublishInput): Promise<Published> {
  const { pair } = input
  const store = deps.approvals.pictures()
  const uploaded: string[] = []
  const entries: Array<{ v: VariantRow; rev: number; file: string }> = []
  const rows: VariantRecord[] = []
  try {
    for (const v of input.variants) {
      const was = input.published.get(v.id)
      if (was === v.rev) {
        entries.push({ v, rev: was, file: picturePath(pair.projectId, pair.campaignId, v.id, was) })
        continue
      }
      const made = await drawAndUpload(deps, store, input, v)
      uploaded.push(made.file)
      entries.push({ v, ...made })
    }
    const variants = []
    for (const { v, rev, file } of entries) {
      const signed = await storage(() => store.signedUrl(file, PICTURE_URL_MAX_SECONDS))
      rows.push({ variantId: v.id, publishedRev: rev, expiresAt: signed.expiresAt })
      variants.push({
        variantKey: v.id,
        title: v.title,
        sizeLine: sizeLine(v),
        version: rev,
        pictureUrl: signed.url,
        pictureExpiresAt: signed.expiresAt,
      })
    }
    const shown = await input.client.replaceGallery(pair, {
      campaignName: input.campaignName,
      variants,
    })
    if (shown === null) throw approvalsRefusal('approval_link_gone')
  } catch (error) {
    if (uploaded.length > 0) await removeQuietly(deps, store, pair, uploaded)
    throw error
  }
  await removeOld(deps, store, pair, new Set(entries.map((e) => e.file)))
  return { rows, drawn: uploaded.length }
}
