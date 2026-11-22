// clip.update (spec/phases/phase-07.md, "Clips and the track"): a clip's start, trim,
// placement or sound. The changed row is checked as clip.add checks a new one. A change equal
// to what is stored writes nothing and adds no undo entry. Undo V (inverse: clip.update with
// the old values). Agent deny.
import { isDeepStrictEqual } from 'node:util'
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { clipAssetOf } from '@/main/clips/clip-asset'
import { checkClip, clipsOf, readClip, writeClips } from '@/main/clips/write-clip'
import { clipUpdateInput, type ClipReply } from '@/shared/schemas/commands/clip'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import { clipNotFound } from './remove'

const FIELDS = ['startMs', 'inMs', 'outMs', 'placement', 'soundOn'] as const
type Field = (typeof FIELDS)[number]

export function clipUpdate(deps: CoreDeps) {
  return defineCommand({
    name: 'clip.update',
    input: clipUpdateInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const row = readClip(db, input.clipId)
      if (!row) throw clipNotFound()
      const changed = FIELDS.filter(
        (f) => input[f] !== undefined && !isDeepStrictEqual(input[f], row[f]),
      )
      const result = { data: { clipId: row.id } as ClipReply, log: { variantId: row.variantId } }
      if (changed.length === 0) return result
      const next: BackgroundClipRow = { ...row }
      const old: Partial<Pick<BackgroundClipRow, Field>> = {}
      for (const f of changed) {
        Object.assign(old, { [f]: row[f] })
        Object.assign(next, { [f]: input[f] })
      }
      checkClip(next, clipAssetOf(db, row.assetId), clipsOf(db, row.variantId))
      writeClips(ctx, [next], deps.now().toISOString())
      const call = {
        name: 'clip.update',
        input: { projectId: input.projectId, clipId: row.id, ...old },
      }
      return { ...result, inverse: { scope: `variant:${row.variantId}`, call } }
    },
  })
}
