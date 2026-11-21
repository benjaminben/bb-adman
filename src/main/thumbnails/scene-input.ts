// spec/scene.md, "The render service" and "One draw": what one draw of a variant needs, read
// through rows.ts when the draw starts. Assets carry no address and no path.
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import type { SceneInput } from '@/shared/scene/types'

export type VariantScene = { input: SceneInput; rev: number }

// The assets a layer names as its source or its font.
export function layerAssetIds(layer: LayerRow): string[] {
  const ids: string[] = []
  if (layer.source) ids.push(layer.source.assetId)
  if (layer.type === 'text' && 'fontAssetId' in layer.style && layer.style.fontAssetId) {
    ids.push(layer.style.fontAssetId)
  }
  return ids
}

export function variantLayers(project: ProjectHandle, variantId: string): LayerRow[] {
  return (readWireRows(project.db, 'layer') as LayerRow[])
    .filter((l) => l.variantId === variantId)
    .sort((a, b) => a.z - b.z || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))
}

// Null when the variant is not in the project. An asset a layer names that has no row, or is
// not a picture or a font, is left out: the Scene draws nothing for it. `withoutText` leaves
// out the text layers and the fonts only they name (the layout job's picture).
export async function sceneInput(
  deps: Pick<CoreDeps, 'assets'>,
  project: ProjectHandle,
  variantId: string,
  opts: { withoutText?: boolean } = {},
): Promise<VariantScene | null> {
  const variant = readWireRow(project.db, 'variant', { id: variantId }) as VariantRow | null
  if (!variant) return null
  const all = variantLayers(project, variantId)
  const layers = opts.withoutText ? all.filter((l) => l.type !== 'text') : all
  const named = new Set(layers.flatMap(layerAssetIds))
  const missing = new Set(named.size > 0 ? await deps.assets.missingAssetIds(project) : [])
  const assets: SceneInput['assets'] = {}
  for (const row of readWireRows(project.db, 'asset') as AssetRow[]) {
    if (!named.has(row.id) || (row.kind !== 'image' && row.kind !== 'font')) continue
    assets[row.id] = {
      kind: row.kind,
      missing: missing.has(row.id),
      width: row.width,
      height: row.height,
    }
  }
  const { width, height, language, format, durationMs } = variant
  return {
    rev: variant.rev,
    input: {
      projectId: project.projectId,
      variant: { width, height, language, format, durationMs },
      layers,
      assets,
      timeMs: 0,
      mode: 'full',
    },
  }
}
