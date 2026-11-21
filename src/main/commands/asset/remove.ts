// asset.remove (SPEC 4.2; FR-197). Not undoable. Refused while a layer (its picture or its
// font), a background clip or a rule set uses the asset (SPEC 3.10, 14 contracts A and C).
// The file itself is left where it is: a file no asset row names is not an asset (SPEC 3.9).
import { eq } from 'drizzle-orm'
import { defineCommand } from '@/main/commands/types'
import { asset } from '@/main/db/schema'
import { requireAsset } from './update'
import { assetInUse, assetInUseError } from '@/main/assets/in-use'
import { assetRemoveInput } from '@/shared/schemas/commands/asset'

export function assetRemove() {
  return defineCommand({
    name: 'asset.remove',
    input: assetRemoveInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      requireAsset(ctx, input.assetId)
      if (assetInUse(ctx.project.db, input.assetId)) throw assetInUseError()
      ctx.changes.touch('asset', { id: input.assetId })
      ctx.project.orm.delete(asset).where(eq(asset.id, input.assetId)).run()
      return { data: { assetId: input.assetId } }
    },
  })
}
