// spec/brief-brand.md "The rules" and "Shared helpers" (A-398): a brief's two brand fonts on a
// new master's text layers. The heading font goes on the headline only, the body font on every
// other text layer; a font the brief does not give leaves those layers on their own font. Pure.
import type { NewLayer } from './types'

export type BrandFontRole = 'heading' | 'body'
export type BrandFonts = { heading?: string | null; body?: string | null }

const HEADING_KEY = 'headline'

export function brandFontRole(key: string): BrandFontRole {
  return key === HEADING_KEY ? 'heading' : 'body'
}

// Fresh copies; picture and background layers are copied unchanged.
export function withBrandFonts(layers: readonly NewLayer[], fonts: BrandFonts): NewLayer[] {
  return layers.map((layer) => {
    const copy = structuredClone(layer)
    const font = fonts[brandFontRole(layer.key)]
    if (copy.type === 'text' && font && 'fontAssetId' in copy.style) {
      copy.style.fontAssetId = font
    }
    return copy
  })
}
