// asset.importFiles (spec/phases/round-2-platform.md, D5): an agent's import of files by their
// full paths, asked every time. The text rules run in the permission broker before the ask and
// again here; prepare then checks each file on disk and copies it (never links it); run inserts
// one row per new file as asset.import does. Not undoable, as asset.import is not.
import { z } from 'zod'
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { asset } from '@/main/db/schema'
import { assetIdsByHash, removeCopies, type NewAsset } from '@/main/assets/import'
import { prepareFileImport } from '@/main/assets/import-files'
import { logUnreadable } from '@/main/assets/unreadable'
import { assetImportFilesInput } from '@/shared/schemas/commands/asset-files'
import { AppError } from '@/shared/schemas/result'

// The shared input with no length cap on paths: more than 20 is the text rules' own refusal,
// too_many_files, which names the limit (R2P-5 ruling).
export const importFilesInput = assetImportFilesInput
  .extend({ paths: z.array(z.string()).min(1) })
  .strict()
type ImportFilesInput = z.infer<typeof importFilesInput>

export type ImportFilesReply = { assetIds: string[] }

function rowOf(a: NewAsset, library: ImportFilesInput['library'], createdAt: string) {
  return {
    id: a.id,
    library,
    kind: a.type.kind,
    origin: 'imported',
    storage: a.storage,
    subjectId: null,
    displayName: a.fileName,
    absPath: a.absPath,
    relPath: a.relPath,
    mime: a.type.mime,
    byteSize: a.byteSize,
    mtimeMs: a.mtimeMs,
    contentHash: a.contentHash,
    width: a.width,
    height: a.height,
    durationMs: a.durationMs,
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

export function assetImportFiles(deps: Pick<CoreDeps, 'now' | 'log'>) {
  return defineCommand({
    name: 'asset.importFiles',
    input: importFilesInput,
    projectId: (input) => input.projectId,
    prepare: (ctx, input) =>
      logUnreadable(deps.log, { command: 'asset.importFiles', actor: ctx.actor }, () =>
        prepareFileImport(ctx.project, input.paths),
      ),
    undoPrepare: (prepared) => removeCopies(prepared.copies),
    run(ctx, input, prepared) {
      const known = assetIdsByHash(ctx.project)
      const createdAt = deps.now().toISOString()
      for (const a of prepared.newAssets) {
        if (known.has(a.contentHash)) continue
        ctx.project.orm
          .insert(asset)
          .values(rowOf(a, input.library, createdAt))
          .run()
        ctx.changes.touch('asset', { id: a.id })
        known.set(a.contentHash, a.id)
      }
      const data: ImportFilesReply = { assetIds: prepared.hashes.map((h) => idFor(known, h)) }
      return { data }
    },
  })
}
