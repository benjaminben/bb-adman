// The variant query domain (spec/editor-commands.md, "variant.get"): one variant with its
// layers, its clips (P7-9) and the assets they name. Both actors may call it.
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { badgesOf, openFor } from './campaign-reads'
import { masterOf } from '@/main/links/master-of'
import { assetsOf, layersOf, requireVariant, subjectIdsOf } from './variant-reads'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { ActivityLog } from '@/main/log/activity-log'
import { variantGetInput, type VariantGet } from '@/shared/schemas/queries/variant'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import type Database from 'better-sqlite3'

const byId = (a: { id: string }, b: { id: string }) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

// The variant's clips by startMs, then ID. A row that cannot be read is left out and logged.
function clipsOf(db: Database.Database, variantId: string, log: ActivityLog): BackgroundClipRow[] {
  return (readWireRows(db, 'background_clip', log) as BackgroundClipRow[])
    .filter((c) => c.variantId === variantId)
    .sort((a, b) => a.startMs - b.startMs || byId(a, b))
}

// The layers' assets and each clip's asset, once, by ID.
function withClipAssets(
  db: Database.Database,
  assets: Array<AssetRow & { missing: boolean }>,
  clips: BackgroundClipRow[],
  missing: Set<string>,
): Array<AssetRow & { missing: boolean }> {
  const named = new Set(assets.map((a) => a.id))
  const more = [...new Set(clips.map((c) => c.assetId))].flatMap((id) => {
    const row = named.has(id) ? null : (readWireRow(db, 'asset', { id }) as AssetRow | null)
    return row ? [{ ...row, missing: missing.has(id) }] : []
  })
  return [...assets, ...more].sort(byId)
}

export function variantGet(deps: Pick<CoreDeps, 'projects' | 'assets' | 'log'>): QueryFn {
  return async (raw): Promise<VariantGet> => {
    const { input, project } = openFor(deps, variantGetInput, raw)
    const db = project.db
    const { variant, direction } = requireVariant(db, input.variantId)
    const layers = layersOf(db, variant.id, deps.log)
    const clips = clipsOf(db, variant.id, deps.log)
    const missing = new Set(await deps.assets.missingAssetIds(project))
    return {
      variant: {
        ...variant,
        isMaster: direction.masterVariantId === variant.id,
        subjectIds: subjectIdsOf(db, variant.id, deps.log),
        badges: badgesOf(db, variant, layers, missing, masterOf(db, direction.id)),
      },
      campaignId: direction.campaignId,
      layers,
      clips,
      assets: withClipAssets(db, assetsOf(db, layers, missing), clips, missing),
    }
  }
}

export function variantQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'variant.get': variantGet(deps) }
}
