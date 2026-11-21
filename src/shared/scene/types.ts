// spec/scene.md, "Props" and "One draw": what the Scene draws and what the main process sends
// the render window. Shared code: no import from main, renderer, preload or Electron.
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
  kind: 'image' | 'font'
  missing: boolean
  width: number | null // from the asset row; null for WebP and fonts
  height: number | null
  version: number // goes up when the file changed on disk
}

export type SceneMode = 'full' | 'overlay-only'

export type SceneSettled = { overflow: Record<string, boolean> }

export type SceneProps = {
  variant: SceneVariant
  layers: LayerRow[] // any order; drawn by z
  assets: Readonly<Record<string, SceneAsset>> // every asset a layer names as source or font
  timeMs: number // 0 for an image variant; used from Phase 7
  mode: SceneMode
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
}
