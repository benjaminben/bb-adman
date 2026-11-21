import { useMemo } from 'react'
import interUrl from './fonts/InterVariable.woff2?url'

// spec/scene.md "Fonts": the one owner of the font family names and their registration.
export const DEFAULT_FONT_FAMILY = 'adman-default'

export type SceneFont = { assetId: string; url: string; version: number }

type Registered = { version: number; face: FontFace; loaded: Promise<void> }

const registered = new Map<string, Registered>()
let defaultLoaded: Promise<void> | null = null

export function fontFamilyOf(fontAssetId: string | null): string {
  const fallback = `"${DEFAULT_FONT_FAMILY}"`
  return fontAssetId === null ? fallback : `"adman-font-${fontAssetId}", ${fallback}`
}

function addFace(family: string, url: string, weight: string): FontFace {
  const face = new FontFace(family, `url("${url}")`, { weight, style: 'normal' })
  document.fonts.add(face)
  return face
}

// A face that fails counts as settled: its text stays in the bundled font.
function loadQuietly(face: FontFace): Promise<void> {
  return face.load().then(
    () => undefined,
    () => undefined,
  )
}

// The bundled Inter, registered once for its weights 100 to 900.
export function registerDefaultFont(): Promise<void> {
  if (!defaultLoaded) defaultLoaded = loadQuietly(addFace(DEFAULT_FONT_FAMILY, interUrl, '100 900'))
  return defaultLoaded
}

// One face per asset and version. A newer version replaces the older face, so a file changed
// on disk is loaded again under the same family name.
function register(font: SceneFont): Promise<void> {
  const known = registered.get(font.assetId)
  if (known?.version === font.version) return known.loaded
  if (known) document.fonts.delete(known.face)
  const face = addFace(`adman-font-${font.assetId}`, font.url, '1 1000')
  const loaded = loadQuietly(face)
  registered.set(font.assetId, { version: font.version, face, loaded })
  return loaded
}

// Registers every font the layers name and gives a promise that settles once each has
// loaded or failed. Registering twice is harmless, so a repeated render adds nothing.
export function useSceneFonts(fonts: readonly SceneFont[]): Promise<void> {
  const signature = JSON.stringify(fonts.map((font) => [font.assetId, font.url, font.version]))
  return useMemo(() => {
    const list: SceneFont[] = JSON.parse(signature).map(
      ([assetId, url, version]: [string, string, number]) => ({ assetId, url, version }),
    )
    return Promise.all(list.map(register)).then(() => undefined)
  }, [signature])
}
