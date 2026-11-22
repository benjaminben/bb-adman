// variant.setSound (spec/phases/phase-07.md, "Clips and the track", Sound, A-184): the clips'
// own sound, one audio file, or none. Undo V. Agent deny. 'file' needs an audio asset in the
// assets library; 'file' with no assetId keeps the stored one. Leaving 'file' keeps the ID.
import type Database from 'better-sqlite3'
import { defineCommand } from '@/main/commands/types'
import { bumpVariantRev } from '@/main/commands/variant-rev'
import type { CoreDeps } from '@/main/core-deps'
import { AppError } from '@/shared/schemas/result'
import { variantSetSoundInput, type VariantSetSoundInput } from '@/shared/schemas/commands/variant'
import { videoRefusal } from '@/shared/video/messages'

type Sound = VariantSetSoundInput['sound']
type Stored = { sound: Sound; sound_asset_id: string | null }

// The audio asset 'file' names, or the refusal.
function soundFile(db: Database.Database, assetId: string | null): string {
  const row = assetId
    ? (db.prepare('SELECT library, kind FROM asset WHERE id = ?').get(assetId) as
        { library: string; kind: string } | undefined)
    : undefined
  if (!assetId || row?.library !== 'asset' || row.kind !== 'audio')
    throw videoRefusal('sound_asset_not_audio')
  return assetId
}

export function variantSetSound(deps: CoreDeps) {
  return defineCommand({
    name: 'variant.setSound',
    input: variantSetSoundInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const db = ctx.project.db
      const row = db
        .prepare('SELECT sound, sound_asset_id FROM variant WHERE id = ?')
        .get(input.variantId) as Stored | undefined
      if (!row) throw new AppError('NOT_FOUND', 'That variant was not found.')
      const assetId =
        input.sound === 'file'
          ? soundFile(db, input.assetId ?? row.sound_asset_id)
          : row.sound_asset_id
      const result = { data: { variantId: input.variantId }, log: { variantId: input.variantId } }
      if (row.sound === input.sound && row.sound_asset_id === assetId) return result
      db.prepare('UPDATE variant SET sound = ?, sound_asset_id = ? WHERE id = ?').run(
        input.sound,
        assetId,
        input.variantId,
      )
      bumpVariantRev(ctx, input.variantId, deps.now().toISOString())
      const back =
        row.sound === 'file' && row.sound_asset_id
          ? { sound: row.sound, assetId: row.sound_asset_id }
          : { sound: row.sound }
      const call = {
        name: 'variant.setSound',
        input: { projectId: input.projectId, variantId: input.variantId, ...back },
      }
      return { ...result, inverse: { scope: `variant:${input.variantId}`, call } }
    },
  })
}
