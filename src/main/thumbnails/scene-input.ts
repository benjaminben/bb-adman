// spec/scene.md, "The render service" and "One draw": what one draw of a variant needs, read
// through rows.ts when the draw starts. Assets carry no address and no path.
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow, readWireRows } from '@/main/db/rows'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import type { SceneClip, SceneInput } from '@/shared/scene/types'
import { safeClip, safePlacement } from '@/shared/scene/clip-at'
import { posterTimeMs } from '@/shared/scene/timing'

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

// phase-07.md "Clips and the track": a clip is drawn from a picture (PNG, JPEG, WebP) or an
// MP4 or MOV video in the asset library. Any other row draws nothing.
const CLIP_PICTURES = new Set(['image/png', 'image/jpeg', 'image/webp'])
const CLIP_VIDEOS = new Set(['video/mp4', 'video/quicktime'])

function clipKind(row: AssetRow | undefined): 'image' | 'video' | null {
  if (!row || row.library !== 'asset') return null
  if (row.kind === 'image' && CLIP_PICTURES.has(row.mime)) return 'image'
  if (row.kind === 'video' && CLIP_VIDEOS.has(row.mime)) return 'video'
  return null
}

const byStart = (a: BackgroundClipRow, b: BackgroundClipRow) =>
  a.startMs - b.startMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

// P7-8: a video variant's clips by start, then ID, with their assets added to `assets`. A
// clip row may come from someone else's project file: its numbers are clamped and rounded,
// and a clip whose asset is missing or not of a kind above is left out.
function trackOf(
  project: ProjectHandle,
  variantId: string,
  rows: AssetRow[],
  missing: Set<string>,
  assets: SceneInput['assets'],
): SceneClip[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  const stored = (readWireRows(project.db, 'background_clip') as BackgroundClipRow[])
    .filter((c) => c.variantId === variantId)
    .sort(byStart)
  return stored.flatMap(({ variantId: _variant, placement, ...row }) => {
    const asset = byId.get(row.assetId)
    const kind = clipKind(asset)
    if (!asset || !kind || missing.has(asset.id)) return []
    const clip = safeClip({ ...row, placement: placement && safePlacement(placement) })
    if (!clip) return []
    assets[asset.id] = { kind, missing: false, width: asset.width, height: asset.height }
    return [clip]
  })
}

// Null when the variant is not in the project. An asset a layer names that has no row, or is
// not a picture or a font, is left out: the Scene draws nothing for it. `withoutText` leaves
// out the text layers and the fonts only they name (the layout job's picture). `timeMs` is the
// time the variant is drawn at, 0 when left out; 'poster' is a video variant's poster time
// (A-183). A video variant's input carries its clips (P7-8). `backgroundOnly` keeps the
// background layer alone, beside the clips (P7-16, a background start's first frame).
export async function sceneInput(
  deps: Pick<CoreDeps, 'assets'>,
  project: ProjectHandle,
  variantId: string,
  opts: { withoutText?: boolean; backgroundOnly?: boolean; timeMs?: number | 'poster' } = {},
): Promise<VariantScene | null> {
  const variant = readWireRow(project.db, 'variant', { id: variantId }) as VariantRow | null
  if (!variant) return null
  const all = variantLayers(project, variantId)
  const kept = (l: LayerRow) =>
    opts.backgroundOnly ? l.type === 'background' : !opts.withoutText || l.type !== 'text'
  const layers = all.filter(kept)
  const named = new Set(layers.flatMap(layerAssetIds))
  const video = variant.format === 'video'
  const check = named.size > 0 || video
  const missing = new Set(check ? await deps.assets.missingAssetIds(project) : [])
  const assets: SceneInput['assets'] = {}
  const rows = readWireRows(project.db, 'asset') as AssetRow[]
  for (const row of rows) {
    if (!named.has(row.id) || (row.kind !== 'image' && row.kind !== 'font')) continue
    assets[row.id] = {
      kind: row.kind,
      missing: missing.has(row.id),
      width: row.width,
      height: row.height,
    }
  }
  const clips = video ? trackOf(project, variantId, rows, missing, assets) : null
  const { width, height, language, format, durationMs } = variant
  const time = opts.timeMs === 'poster' ? (video ? posterTimeMs(all, durationMs) : 0) : opts.timeMs
  return {
    rev: variant.rev,
    input: {
      projectId: project.projectId,
      variant: { width, height, language, format, durationMs },
      layers,
      assets,
      timeMs: time ?? 0,
      mode: 'full',
      ...(clips ? { clips } : {}),
    },
  }
}
