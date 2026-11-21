// Reads for the translation commands (spec/phases/phase-06.md, design addition 2): a layer
// with its variant, direction and the campaign's primary language; the master's layer with a
// key; the same-language twins of a layer. Reads only, from the open project's own file.
import type Database from 'better-sqlite3'
import { readWireRow } from '@/main/db/rows'
import { masterOf } from '@/main/links/master-of'
import type { CampaignRow } from '@/shared/schemas/rows/campaign'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { AppError } from '@/shared/schemas/result'

export type PlacedLayer = {
  layer: LayerRow
  variant: VariantRow
  direction: DirectionRow
  primaryLanguage: string
}

export const notText = () => new AppError('INVALID_INPUT', 'Translations are for text layers.')

export const notATranslation = () =>
  new AppError(
    'RULE_VIOLATION',
    "This text is in the campaign's main language. Change it in the editor.",
    { reason: 'not_a_translation' },
  )

// The layer and where it sits, or NOT_FOUND when the layer or a row above it is gone.
export function placeLayer(db: Database.Database, layerId: string): PlacedLayer {
  const layer = readWireRow(db, 'layer', { id: layerId }) as LayerRow | null
  const variant = layer ? (readWireRow(db, 'variant', { id: layer.variantId }) as VariantRow) : null
  const direction = variant
    ? (readWireRow(db, 'direction', { id: variant.directionId }) as DirectionRow | null)
    : null
  const campaign = direction
    ? (readWireRow(db, 'campaign', { id: direction.campaignId }) as CampaignRow | null)
    : null
  if (!layer || !variant || !direction || !campaign) {
    throw new AppError('NOT_FOUND', 'That layer was not found.')
  }
  return { layer, variant, direction, primaryLanguage: campaign.primaryLanguage }
}

// A text layer of a variant not in the primary language; refuses anything else.
export function requireTranslation(placed: PlacedLayer): void {
  if (placed.layer.type !== 'text') throw notText()
  if (placed.variant.language === placed.primaryLanguage) throw notATranslation()
}

// The layer with this key in the direction's master, or null.
export function masterLayerByKey(
  db: Database.Database,
  directionId: string,
  key: string,
): LayerRow | null {
  return masterOf(db, directionId)?.layers.find((l) => l.key === key) ?? null
}

// The text layers with the layer's key in every other variant of its direction and language,
// leaving out those whose overrides hold copy. Ordered by variant ID.
export function sameLanguageTwins(db: Database.Database, placed: PlacedLayer): LayerRow[] {
  const ids = db
    .prepare(
      `SELECT l.id FROM layer l JOIN variant v ON v.id = l.variant_id
       WHERE v.direction_id = ? AND v.language = ? AND l.key = ? AND l.type = 'text'
         AND v.id != ?
       ORDER BY v.id`,
    )
    .all(
      placed.direction.id,
      placed.variant.language,
      placed.layer.key,
      placed.variant.id,
    ) as Array<{
    id: string
  }>
  return ids
    .map(({ id }) => readWireRow(db, 'layer', { id }) as LayerRow | null)
    .filter((l): l is LayerRow => l !== null && !l.overrides.includes('copy'))
}
