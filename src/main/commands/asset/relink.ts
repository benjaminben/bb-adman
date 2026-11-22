// asset.relink (SPEC 4.2; SPEC 14, Slice A rulings point 3; FR-009). Not undoable. prepare
// reads the new file and finds siblings; run checks each row again and writes it. After a
// relink the asset is linked. No file is moved, copied or deleted.
import { eq } from 'drizzle-orm'
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { asset } from '@/main/db/schema'
import { readWireRow } from '@/main/db/rows'
import { requireAsset } from './update'
import { prepareRelink } from '@/main/assets/relink'
import { logUnreadable } from '@/main/assets/unreadable'
import { assetRelinkInput } from '@/shared/schemas/commands/asset'
import type { AssetRow } from '@/shared/schemas/rows/asset'

export function assetRelink(deps: Pick<CoreDeps, 'log'>) {
  return defineCommand({
    name: 'asset.relink',
    input: assetRelinkInput,
    projectId: (input) => input.projectId,
    prepare: (ctx, input) =>
      logUnreadable(deps.log, { command: 'asset.relink', actor: ctx.actor }, () =>
        prepareRelink(ctx.project, input),
      ),
    run(ctx, input, prepared) {
      requireAsset(ctx, input.assetId)
      const { file } = prepared
      ctx.project.orm
        .update(asset)
        .set({
          storage: 'linked',
          absPath: file.file,
          relPath: prepared.relPath,
          mime: file.type.mime,
          byteSize: file.byteSize,
          mtimeMs: file.mtimeMs,
          contentHash: file.contentHash,
          width: file.width,
          height: file.height,
          durationMs: file.durationMs,
          fontFamily: file.fontFamily,
        })
        .where(eq(asset.id, input.assetId))
        .run()
      ctx.changes.touch('asset', { id: input.assetId })
      const siblingIds: string[] = []
      for (const s of prepared.siblings) {
        const row = readWireRow(ctx.project.db, 'asset', { id: s.id }) as AssetRow | null
        if (row?.storage !== 'linked' || row.contentHash !== s.contentHash) continue
        const { absPath, relPath, byteSize, mtimeMs } = s
        ctx.project.orm
          .update(asset)
          .set({ absPath, relPath, byteSize, mtimeMs })
          .where(eq(asset.id, s.id))
          .run()
        ctx.changes.touch('asset', { id: s.id })
        siblingIds.push(s.id)
      }
      return { data: { assetId: input.assetId, siblingIds } }
    },
  })
}
