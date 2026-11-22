// spec/scene.md, "Props" and "One draw": what the Scene draws and what the main process sends
// the render window. Shared code: no import from main, renderer, preload or Electron.
import type { Geometry } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'

export type SceneVariant = {
  width: number // pixels
  height: number
  language: string // BCP-47; becomes the root's lang attribute
  format: 'image' | 'video'
  durationMs: number
}

export type SceneAsset = {
  url: string // adman-asset:// address, built by the caller
  kind: 'image' | 'video' | 'font'
  missing: boolean
  width: number | null // from the asset row; null for WebP and fonts
  height: number | null
  version: number // goes up when the file changed on disk
}

// P7-1: one clip on a video variant's background track, in whole milliseconds. placement null
// = the background layer's geometry (spec/phases/phase-07.md, "Clips and the track").
export type SceneClip = {
  id: string
  assetId: string
  startMs: number
  inMs: number
  outMs: number
  placement: Geometry | null
  soundOn: boolean
}

export type SceneMode = 'full' | 'overlay-only'

export type SceneSettled = { overflow: Record<string, boolean> }

export type SceneProps = {
  variant: SceneVariant
  layers: LayerRow[] // any order; drawn by z
  assets: Readonly<Record<string, SceneAsset>> // every asset a layer names as source or font
  timeMs: number // 0 for an image variant; used from Phase 7
  mode: SceneMode
  // P7-1, drawn from P7-8: the background track; the playhead moving; the clips' own sound on.
  clips?: SceneClip[]
  playing?: boolean
  sound?: boolean
  onSettled?: (result: SceneSettled) => void
}

// What one draw sends the render window: no addresses, no paths.
export type SceneInput = {
  projectId: string
  variant: SceneVariant
  layers: LayerRow[]
  assets: Record<string, Omit<SceneAsset, 'url' | 'version'>>
  timeMs: number
  mode: SceneMode
  clips?: SceneClip[]
}
