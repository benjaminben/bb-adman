// asset.import (SPEC 4.2, 3.6; FR-050 to FR-054, R-08). Not undoable. prepare inspects and
// copies the files; run inserts one row per new content hash. run checks the hashes again,
// since another command may have added the same file in between (SPEC 3.6).
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { asset } from '@/main/db/schema'
import { requireSubject } from './update'
import { assetIdsByHash, prepareImport, removeCopies, type NewAsset } from '@/main/assets/import'
import { assetImportInput, type AssetImportInput } from '@/shared/schemas/commands/asset'
import { logUnreadable } from '@/main/assets/unreadable'
import { AppError } from '@/shared/schemas/result'

function rowOf(a: NewAsset, input: AssetImportInput, createdAt: string) {
  return {
    id: a.id,
    library: input.library,
    kind: a.type.kind,
    origin: 'imported',
    storage: a.storage,
    subjectId: input.subjectId ?? null,
    displayName: a.fileName,
    absPath: a.absPath,
    relPath: a.relPath,
    mime: a.type.mime,
    byteSize: a.byteSize,
    mtimeMs: a.mtimeMs,
    contentHash: a.contentHash,
    width: a.width,
    height: a.height,
    fontFamily: a.fontFamily,
    createdAt,
  }
}

// A file prepare found in the project, whose asset was removed before run.
function idFor(known: Map<string, string>, hash: string): string {
  const id = known.get(hash)
  if (!id) {
    throw new AppError(
      'RULE_VIOLATION',
      'The project changed while the files were read. Try again.',
    )
  }
  return id
}

export function assetImport(deps: Pick<CoreDeps, 'now' | 'log'>) {
  return defineCommand({
    name: 'asset.import',
    input: assetImportInput,
    projectId: (input) => input.projectId,
    prepare: (ctx, input) =>
      logUnreadable(deps.log, { command: 'asset.import', actor: ctx.actor }, () =>
        prepareImport(ctx.project, input.paths, input.copy),
      ),
    undoPrepare: (prepared) => removeCopies(prepared.copies),
    run(ctx, input, prepared) {
      if (input.subjectId) requireSubject(ctx, input.subjectId)
      const known = assetIdsByHash(ctx.project)
      const before = new Set(known.values())
      const createdAt = deps.now().toISOString()
      for (const a of prepared.newAssets) {
        if (known.has(a.contentHash)) continue
        ctx.project.orm
          .insert(asset)
          .values(rowOf(a, input, createdAt))
          .run()
        ctx.changes.touch('asset', { id: a.id })
        known.set(a.contentHash, a.id)
      }
      const assetIds = prepared.hashes.map((h) => idFor(known, h))
      // SPEC 14, Slice A rulings point 5.
      const reusedAssetIds = [...new Set(assetIds.filter((id) => before.has(id)))]
      return { data: { assetIds, reusedAssetIds, skippedCount: prepared.skippedCount } }
    },
  })
}
