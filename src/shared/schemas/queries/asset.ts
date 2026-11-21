import { z } from 'zod'
import { projectScoped } from '../commands/project-scoped'
import type { AssetRow } from '../rows/asset'

export const assetLibrary = z.enum(['reference', 'asset'])
export const assetKind = z.enum(['image', 'video', 'font', 'text'])

// SPEC 4.3 asset.list: assets filtered by library, kind and subject.
export const assetListInput = projectScoped.extend({
  library: assetLibrary.optional(),
  kind: assetKind.optional(),
  subjectId: z.string().min(1).optional(),
})
export type AssetListInput = z.infer<typeof assetListInput>

// Each wire row with missing: true when the path resolver finds no file (FR-009).
export type AssetList = Array<AssetRow & { missing: boolean }>
