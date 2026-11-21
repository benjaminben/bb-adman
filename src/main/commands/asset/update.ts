// asset.update (SPEC 4.2; FR-054, R-12). Not undoable. Changes only the fields it is given.
import { eq } from 'drizzle-orm'
import { defineCommand, type ProjectContext } from '../types'
import { asset } from '../../db/schema'
import { readWireRow } from '../../db/rows'
import { assetNotFound } from '../../assets/errors'
import { assetUpdateInput, type AssetUpdateInput } from '../../../shared/schemas/commands/asset'
import { AppError } from '../../../shared/schemas/result'

export function requireAsset(ctx: ProjectContext, assetId: string): void {
  if (!readWireRow(ctx.project.db, 'asset', { id: assetId })) throw assetNotFound()
}

export function requireSubject(ctx: ProjectContext, subjectId: string): void {
  if (!readWireRow(ctx.project.db, 'subject', { id: subjectId })) {
    throw new AppError('NOT_FOUND', 'That subject is not in this project.')
  }
}

function patchOf(input: AssetUpdateInput) {
  return {
    ...(input.library !== undefined ? { library: input.library } : {}),
    ...(input.subjectId !== undefined ? { subjectId: input.subjectId } : {}),
    ...(input.displayName !== undefined ? { displayName: input.displayName } : {}),
    ...(input.fontPublishAllowed !== undefined
      ? { fontPublishAllowed: input.fontPublishAllowed ? 1 : 0 }
      : {}),
  }
}

export function assetUpdate() {
  return defineCommand({
    name: 'asset.update',
    input: assetUpdateInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      requireAsset(ctx, input.assetId)
      if (input.subjectId) requireSubject(ctx, input.subjectId)
      const patch = patchOf(input)
      if (Object.keys(patch).length > 0) {
        ctx.project.orm.update(asset).set(patch).where(eq(asset.id, input.assetId)).run()
        ctx.changes.touch('asset', { id: input.assetId })
      }
      return { data: { assetId: input.assetId } }
    },
  })
}
