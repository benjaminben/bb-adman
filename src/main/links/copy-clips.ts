// spec/make-variants.md, "Making variants from a variant", "A video source": a new video
// variant copies the clips of a video source (the master included): asset, start, trims and
// sound_on; a clip's own placement is kept at the same pixel size and set to null at another.
// Only asset IDs already in this project are copied: each row passes the checks every clip
// command makes (clipAssetOf, checkClip), so no file is read and no path is taken. A row that
// fails them (a project file made elsewhere can hold anything) is left out.
import type { ProjectContext } from '@/main/commands/types'
import { clipAssetOf } from '@/main/clips/clip-asset'
import { checkClip, clipsOf, writeClips } from '@/main/clips/write-clip'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import { AppError } from '@/shared/schemas/result'
import { ulid } from 'ulid'

// The copied rows; empty when the source has none or none passes the checks.
function copiedRows(
  ctx: ProjectContext,
  sourceVariantId: string,
  variantId: string,
  samePixelSize: boolean,
): BackgroundClipRow[] {
  const db = ctx.project.db
  const rows: BackgroundClipRow[] = []
  for (const clip of clipsOf(db, sourceVariantId)) {
    const row = {
      ...clip,
      id: ulid(),
      variantId,
      placement: samePixelSize ? clip.placement : null,
    }
    try {
      checkClip(row, clipAssetOf(db, row.assetId), rows)
    } catch (error) {
      if (!(error instanceof AppError)) throw error
      continue
    }
    rows.push(row)
  }
  return rows
}

// True when at least one clip was copied; first_clip_made is then 1.
export function copyClips(
  ctx: ProjectContext,
  sourceVariantId: string,
  variantId: string,
  samePixelSize: boolean,
  now: string,
): boolean {
  const rows = copiedRows(ctx, sourceVariantId, variantId, samePixelSize)
  if (rows.length === 0) return false
  writeClips(ctx, rows, now)
  return true
}
