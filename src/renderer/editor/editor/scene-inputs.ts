// What the editor's canvas gives the Scene from the variant store: the assets by ID, each at
// its adman-asset address, and a video variant's clips (P7-8, P7-21). A video goes in only when
// a clip uses it and it is an MP4 or MOV of the assets library whose file is found.
import type { VariantStoreState } from '@/renderer/stores/variant-store'
import { assetUrl } from '@/renderer/ui/asset-url'
import type { SceneAsset, SceneClip } from '@/shared/scene/types'

const CLIP_VIDEOS = new Set(['video/mp4', 'video/quicktime'])

type Held = Pick<VariantStoreState, 'assets' | 'versions' | 'clips'>
type Asset = VariantStoreState['assets'][string]

function kindOf(a: Asset, clipAssets: Set<string>): SceneAsset['kind'] | null {
  if (a.kind === 'image' || a.kind === 'font') return a.kind
  const clipVideo = CLIP_VIDEOS.has(a.mime) && a.library === 'asset' && !a.missing
  return a.kind === 'video' && clipVideo && clipAssets.has(a.id) ? 'video' : null
}

export function sceneAssets(
  projectId: string,
  { assets, versions, clips }: Held,
): Record<string, SceneAsset> {
  const clipAssets = new Set(Object.values(clips).map((c) => c.assetId))
  const out: Record<string, SceneAsset> = {}
  for (const a of Object.values(assets)) {
    const kind = kindOf(a, clipAssets)
    if (!kind) continue
    const { missing, width, height } = a
    const version = versions[a.id] ?? 0
    out[a.id] = { url: assetUrl(projectId, a.id), kind, missing, width, height, version }
  }
  return out
}

const byStart = (a: SceneClip, b: SceneClip) =>
  a.startMs - b.startMs || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)

export function sceneClips(clips: VariantStoreState['clips']): SceneClip[] {
  return Object.values(clips)
    .map(({ variantId: _variant, ...clip }) => clip)
    .sort(byStart)
}
