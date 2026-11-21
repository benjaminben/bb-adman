// The sync query domain (spec/links-and-sync.md, "Sync"): sync.preview, what syncing a
// direction would change. Both actors may read it. A read of the one direction only; it
// replies with layer values and never a file path.
import type Database from 'better-sqlite3'
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { openFor } from './campaign-reads'
import { layersOf } from './variant-reads'
import { readWireRow, readWireRows } from '@/main/db/rows'
import { masterOf } from '@/main/links/master-of'
import { syncPreviewOf } from '@/shared/links/sync-plan'
import type { Size } from '@/shared/scene/background-placement'
import { syncPreviewInput, type SyncPreviewReply } from '@/shared/schemas/queries/sync'
import { AppError } from '@/shared/schemas/result'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'

const byId = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0)

// The pixel size of each picture the master's layers name, for an added background. Only the
// width and height leave this function.
function pictureSizesOf(db: Database.Database, layers: LayerRow[]): Record<string, Size> {
  const sizes: Record<string, Size> = {}
  for (const layer of layers) {
    if (!layer.source) continue
    const asset = readWireRow(db, 'asset', { id: layer.source.assetId }) as AssetRow | null
    if (asset?.width && asset.height) {
      sizes[asset.id] = { width: asset.width, height: asset.height }
    }
  }
  return sizes
}

export function syncPreview(deps: Pick<CoreDeps, 'projects' | 'log'>): QueryFn {
  return (raw): SyncPreviewReply => {
    const { input, project } = openFor(deps, syncPreviewInput, raw)
    const db = project.db
    const direction = readWireRow(db, 'direction', { id: input.directionId }) as DirectionRow | null
    if (!direction) throw new AppError('NOT_FOUND', 'That direction was not found.')
    const master = masterOf(db, direction.id)
    // A broken file: the runner answers INTERNAL and logs this line, which holds no data.
    if (!master) throw new Error('sync.preview: the direction has no master row')
    // campaign.get's order inside a direction: the master first, then createdAt, then ID.
    const variants = (readWireRows(db, 'variant', deps.log) as VariantRow[])
      .filter((v) => v.directionId === direction.id && v.id !== master.variant.id)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt) || byId(a.id, b.id))
    return {
      directionId: direction.id,
      masterVariantId: master.variant.id,
      masterRev: master.variant.rev,
      variants: syncPreviewOf({
        master: { row: master.variant, layers: master.layers },
        variants: variants.map((v) => ({ row: v, layers: layersOf(db, v.id, deps.log) })),
        pictureSizes: pictureSizesOf(db, master.layers),
      }),
    }
  }
}

export function syncQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'sync.preview': syncPreview(deps) }
}
