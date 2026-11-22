// Which asset a clip may name (spec/phases/phase-07.md, "Clips and the track", A-177, A-178):
// a picture (PNG, JPEG, WebP) or an MP4 or MOV video of this project, in the asset library.
// The row's numbers came from a file someone else may have made, so a video's facts are
// checked every time: a side below 1, or a length that is missing or past a day, is
// clip_video_unreadable. A video row made before Phase 7 has no facts; prepareClipAsset reads
// them from the file (outside the transaction) and usableClipAsset stores them.
import fs from 'node:fs'
import type Database from 'better-sqlite3'
import type { CoreDeps } from '@/main/core-deps'
import type { PrepareContext, ProjectContext } from '@/main/commands/types'
import { readWireRow } from '@/main/db/rows'
import { videoFileFacts } from '@/main/assets/video-file-facts'
import { MAX_TRACK_MS } from '@/shared/schemas/commands/clip'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import { videoRefusal } from '@/shared/video/messages'

const PICTURES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const VIDEOS = new Set(['video/mp4', 'video/quicktime'])

type Facts = { width: number; height: number; durationMs: number }

// What prepare found on disk: whether the file is missing, and a video's facts when the row
// had none to give.
export type PreparedAsset = { assetId: string; missing: boolean; facts: Facts | null }

// A clip's asset as the track needs it: a still has no length of its own.
export type ClipAsset = { id: string; kind: 'image' | 'video'; durationMs: number | null }

const isUsableKind = (row: AssetRow): boolean =>
  row.library === 'asset' &&
  ((row.kind === 'image' && PICTURES.has(row.mime)) ||
    (row.kind === 'video' && VIDEOS.has(row.mime)))

const hasNoFacts = (row: AssetRow): boolean =>
  row.width === null && row.height === null && row.durationMs === null

const saneFacts = (f: { width: number | null; height: number | null; durationMs: number | null }) =>
  f.width !== null &&
  f.height !== null &&
  f.durationMs !== null &&
  f.width >= 1 &&
  f.height >= 1 &&
  f.durationMs >= 1 &&
  f.durationMs <= MAX_TRACK_MS

async function readFacts(file: string): Promise<Facts | null> {
  try {
    const handle = await fs.promises.open(file, 'r')
    try {
      const facts = await videoFileFacts(handle)
      return facts && { width: facts.width, height: facts.height, durationMs: facts.durationMs }
    } finally {
      await handle.close()
    }
  } catch {
    return null
  }
}

// Outside the transaction: the file's place, and a video's facts when its row has none. It
// writes nothing; an asset that is not there or not usable is judged in usableClipAsset.
export async function prepareClipAsset(
  deps: Pick<CoreDeps, 'assets'>,
  ctx: PrepareContext,
  assetId: string,
): Promise<PreparedAsset> {
  const row = readWireRow(ctx.project.db, 'asset', { id: assetId }) as AssetRow | null
  if (!row || !isUsableKind(row)) return { assetId, missing: false, facts: null }
  const file = await deps.assets.resolve(ctx.project, assetId)
  if (file === 'missing') return { assetId, missing: true, facts: null }
  const facts = row.kind === 'video' && hasNoFacts(row) ? await readFacts(file) : null
  return { assetId, missing: false, facts }
}

// Inside the transaction, with no file read: the asset is of this project, of a usable kind,
// in the asset library, and a video's stored facts are sane. Used by every command that
// writes a clip row, so no command writes a row another would refuse.
export function clipAssetOf(db: Database.Database, assetId: string): ClipAsset {
  const row = readWireRow(db, 'asset', { id: assetId }) as AssetRow | null
  if (!row || !isUsableKind(row)) throw videoRefusal('clip_asset_not_usable')
  if (row.kind === 'image') return { id: row.id, kind: 'image', durationMs: null }
  if (!saneFacts(row)) throw videoRefusal('clip_video_unreadable')
  return { id: row.id, kind: 'video', durationMs: row.durationMs }
}

// clip.add and clip.addGenerated: the stored checks, and a file that is not missing. Facts
// read in prepare are stored on a row that still has none, then checked like stored facts.
export function usableClipAsset(ctx: ProjectContext, prepared: PreparedAsset): ClipAsset {
  const db = ctx.project.db
  const row = readWireRow(db, 'asset', { id: prepared.assetId }) as AssetRow | null
  if (!row || !isUsableKind(row) || prepared.missing) throw videoRefusal('clip_asset_not_usable')
  if (row.kind === 'video' && hasNoFacts(row)) {
    const facts = prepared.facts
    if (!facts || !saneFacts(facts)) throw videoRefusal('clip_video_unreadable')
    db.prepare('UPDATE asset SET width = ?, height = ?, duration_ms = ? WHERE id = ?').run(
      facts.width,
      facts.height,
      facts.durationMs,
      row.id,
    )
    ctx.changes.touch('asset', { id: row.id })
  }
  return clipAssetOf(db, row.id)
}
