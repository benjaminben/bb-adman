// The one place that writes background_clip rows (spec/phases/phase-07.md, "Clips and the
// track", A-180). Every write names the changed rows, bumps variant.rev once per call, and a
// clip put on the track sets variant.first_clip_made. addFirstClip is the image-to-video
// first clip of variant.setFormat (P7-10) and fan-out (P7-23).
import type Database from 'better-sqlite3'
import { ulid } from 'ulid'
import type { ProjectContext } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import { readWireRow, storedJson } from '@/main/db/rows'
import { MAX_TRACK_MS, MIN_CLIP_MS } from '@/shared/schemas/commands/clip'
import { firstFreeStart, overlapsAny, type TrackClip } from '@/shared/clips/track'
import { AppError } from '@/shared/schemas/result'
import { videoRefusal } from '@/shared/video/messages'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { clipAssetOf, type ClipAsset } from './clip-asset'

// A still's default length (A-180): the time left to the variant's end, or 3,000 ms when
// less than the shortest clip is left.
export const STILL_FALLBACK_MS = 3000

export function readClip(db: Database.Database, clipId: string): BackgroundClipRow | null {
  return readWireRow(db, 'background_clip', { id: clipId }) as BackgroundClipRow | null
}

// The variant's clips by startMs, then ID.
export function clipsOf(db: Database.Database, variantId: string): BackgroundClipRow[] {
  const ids = db
    .prepare('SELECT id FROM background_clip WHERE variant_id = ? ORDER BY start_ms, id')
    .all(variantId) as Array<{ id: string }>
  return ids.flatMap(({ id }) => readClip(db, id) ?? [])
}

export function readVariant(db: Database.Database, variantId: string): VariantRow | null {
  return readWireRow(db, 'variant', { id: variantId }) as VariantRow | null
}

// A clip's default length when it starts at startMs: a video's whole file, a still's time
// left to the variant's end.
export function defaultLength(variant: VariantRow, asset: ClipAsset, startMs: number): number {
  if (asset.durationMs !== null) return asset.durationMs
  const left = variant.durationMs - startMs
  return left >= MIN_CLIP_MS ? left : STILL_FALLBACK_MS
}

// A new row from the start of the file, its own placement and sound left at their defaults.
export function newClip(
  variantId: string,
  assetId: string,
  startMs: number,
  lengthMs: number,
): BackgroundClipRow {
  return {
    id: ulid(),
    variantId,
    assetId,
    startMs,
    inMs: 0,
    outMs: lengthMs,
    placement: null,
    soundOn: true,
  }
}

// A clip of its default length at the first free position.
export function placedClip(
  variant: VariantRow,
  track: TrackClip[],
  asset: ClipAsset,
): BackgroundClipRow {
  const lengthAt = (startMs: number) => defaultLength(variant, asset, startMs)
  const startMs = firstFreeStart(track, lengthAt)
  return newClip(variant.id, asset.id, startMs, lengthAt(startMs))
}

const stored = (row: BackgroundClipRow) => ({
  ...row,
  placement: storedJson('background_clip', 'placement', row.placement),
  soundOn: row.soundOn ? 1 : 0,
})

function markFirstClip(ctx: ProjectContext, variantId: string): void {
  const db = ctx.project.db
  const done = db.prepare('SELECT first_clip_made FROM variant WHERE id = ?').get(variantId) as
    { first_clip_made: number } | undefined
  if (done?.first_clip_made === 1) return
  db.prepare('UPDATE variant SET first_clip_made = 1 WHERE id = ?').run(variantId)
  ctx.changes.touch('variant', { id: variantId })
}

// New rows, or rows put back over the ones with their IDs (clip.restore). All of one variant.
export function writeClips(ctx: ProjectContext, rows: BackgroundClipRow[], now: string): void {
  const db = ctx.project.db
  const write = db.prepare(
    `INSERT INTO background_clip (id, variant_id, asset_id, start_ms, in_ms, out_ms, placement,
       sound_on)
     VALUES ($id, $variantId, $assetId, $startMs, $inMs, $outMs, $placement, $soundOn)
     ON CONFLICT(id) DO UPDATE SET asset_id = excluded.asset_id, start_ms = excluded.start_ms,
       in_ms = excluded.in_ms, out_ms = excluded.out_ms, placement = excluded.placement,
       sound_on = excluded.sound_on`,
  )
  for (const row of rows) {
    write.run(stored(row))
    ctx.changes.touch('background_clip', { id: row.id })
  }
  const variantId = rows[0]?.variantId
  if (!variantId) return
  markFirstClip(ctx, variantId)
  bumpVariantRev(ctx, variantId, now)
}

// The rules every written row meets, whichever command writes it: the shortest length, a
// start within the longest ad, a video trim inside its file, and no overlap with the track.
export function checkClip(row: BackgroundClipRow, asset: ClipAsset, track: TrackClip[]): void {
  // A row read back from a file made by someone else can hold any number (P7-9 review).
  const whole = [row.startMs, row.inMs, row.outMs].every(Number.isSafeInteger)
  if (!whole || row.startMs < 0) {
    throw new AppError('INVALID_INPUT', 'A clip starts within the first 24 hours of the track.')
  }
  if (row.inMs < 0 || row.outMs > MAX_TRACK_MS) {
    throw new AppError('INVALID_INPUT', "A clip's trim lies within the first 24 hours of its file.")
  }
  // A file shorter than the shortest clip cannot hold one: its trim reaches past the end.
  const file = asset.durationMs
  if (file !== null && (row.outMs > file || file < MIN_CLIP_MS)) {
    throw videoRefusal('clip_trim_out_of_range')
  }
  if (row.outMs - row.inMs < MIN_CLIP_MS) {
    throw new AppError('INVALID_INPUT', 'A clip runs at least 100 ms.')
  }
  if (row.startMs > MAX_TRACK_MS) {
    throw new AppError('INVALID_INPUT', 'A clip starts within the first 24 hours of the track.')
  }
  if (overlapsAny(row, track)) throw videoRefusal('clip_overlap')
}

export function deleteClip(ctx: ProjectContext, row: BackgroundClipRow, now: string): void {
  ctx.project.db.prepare('DELETE FROM background_clip WHERE id = ?').run(row.id)
  ctx.changes.touch('background_clip', { id: row.id })
  bumpVariantRev(ctx, row.variantId, now)
}

// OI-20, A-180: the first clip from the background's own picture, made only once per variant:
// when first_clip_made is 0, there are no clips and the background has a usable source. The
// clip ID, or null when none is made. No file is read here; a missing file shows its badge.
// clipId (P7-10b, a redo): the ID the clip had before its undo; refused when a clip holds it.
export function addFirstClip(
  ctx: ProjectContext,
  variantId: string,
  now: string,
  clipId?: string,
): string | null {
  const db = ctx.project.db
  if (clipId !== undefined && readClip(db, clipId)) {
    throw new AppError('INVALID_INPUT', 'That clip is already on a post.')
  }
  const variant = readVariant(db, variantId)
  if (!variant || variant.firstClipMade || clipsOf(db, variantId).length > 0) return null
  const background = db
    .prepare("SELECT id FROM layer WHERE variant_id = ? AND type = 'background' LIMIT 1")
    .get(variantId) as { id: string } | undefined
  const layer = background && (readWireRow(db, 'layer', { id: background.id }) as LayerRow)
  if (!layer?.source) return null
  let asset: ClipAsset
  try {
    asset = clipAssetOf(db, layer.source.assetId)
  } catch {
    return null
  }
  const placed = placedClip(variant, [], asset)
  const row = clipId === undefined ? placed : { ...placed, id: clipId }
  checkClip(row, asset, [])
  writeClips(ctx, [row], now)
  return row.id
}
