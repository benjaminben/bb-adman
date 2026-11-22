// R2C-5 (spec/phases/round-2-campaign.md, design addition 5, "No path is drawn"): the one
// picker between asset.list and the panel. A listed row holds the file's paths, hash and type;
// only the fields kept here reach the panel's state and components.
import type { AssetList } from '@/shared/schemas/queries/asset'

type Listed = AssetList[number]

export type AssetView = Pick<
  Listed,
  | 'id'
  | 'kind'
  | 'library'
  | 'origin'
  | 'storage'
  | 'subjectId'
  | 'displayName'
  | 'width'
  | 'height'
  | 'durationMs'
  | 'fontFamily'
  | 'missing'
>

export function assetView(row: Listed): AssetView {
  return {
    id: row.id,
    kind: row.kind,
    library: row.library,
    origin: row.origin,
    storage: row.storage,
    subjectId: row.subjectId,
    displayName: row.displayName,
    width: row.width,
    height: row.height,
    durationMs: row.durationMs,
    fontFamily: row.fontFamily,
    missing: row.missing,
  }
}
