// spec/phases/phase-06.md, design addition 6 (A-166): layer.setFonts, a font per language.
// Its own inverse: the same items with the fonts they had.
import { z } from 'zod'
import { projectScoped } from './project-scoped'

export const LayerFontItem = z
  .object({ layerId: z.string().min(1), fontAssetId: z.string().min(1).nullable() })
  .strict()
export type LayerFontItem = z.infer<typeof LayerFontItem>

export const layerSetFontsInput = projectScoped
  .extend({ items: z.array(LayerFontItem).min(1).max(500) })
  .strict()
export type LayerSetFontsInput = z.infer<typeof layerSetFontsInput>

// The layers changed.
export type LayerSetFontsReply = { layerIds: string[] }
