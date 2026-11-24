// Test helper for MV-7 (spec/make-variants.md, "Which layout", "Text that fits"): changes to the
// fan-out fixture's campaign and master that the new placement and the fit read. Not a test
// file itself.
import type { FanOutBus } from './fan-out-fixture'
import { copyRow } from './linked-fixture'
import { DEFAULT_STARTER_LAYOUT } from '@/shared/config/default-layout'
import { starterLayoutOf } from '@/shared/config/starter-layouts'
import { layoutBoxOf } from '@/shared/links/source-layout'
import type { Geometry, TextStyle } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'

export const SMALL = { label: '300x250', width: 300, height: 250 }
const SQUARE_PX = { width: 1080, height: 1080 }

// Plain words of 8 letters and a space, cut to `n` letters.
export const words = (n: number) => 'abcdefgh '.repeat(Math.ceil(n / 9)).slice(0, n)

export const TOP = starterLayoutOf('photo-top-centre') ?? DEFAULT_STARTER_LAYOUT

export function setBrief(bus: FanOutBus, path: string, value: unknown): void {
  bus.db
    .prepare('UPDATE campaign SET brief = json_set(brief, ?, json(?)) WHERE id = ?')
    .run(path, JSON.stringify(value), bus.campaignId)
}

export function addCampaignSize(bus: FanOutBus, size: typeof SMALL): void {
  const row = bus.db.prepare('SELECT sizes FROM campaign WHERE id = ?').get(bus.campaignId) as {
    sizes: string
  }
  const sizes = [...(JSON.parse(row.sizes) as unknown[]), size]
  bus.db
    .prepare('UPDATE campaign SET sizes = ? WHERE id = ?')
    .run(JSON.stringify(sizes), bus.campaignId)
}

export const layerOf = (bus: FanOutBus, variantId: string, key: string) =>
  bus.layers(variantId).find((l) => l.key === key) as LayerRow

export const fontSizeOf = (layer: LayerRow) => (layer.style as TextStyle).fontSize

const setGeometry = (bus: FanOutBus, id: string, geometry: Geometry | null) =>
  bus.db.prepare('UPDATE layer SET geometry = ? WHERE id = ?').run(JSON.stringify(geometry), id)

// A master whose logo sits in the default layout and whose headline sits in photo-top-centre:
// one layer each, a tie that the campaign's stored layout breaks.
export function tiedMaster(bus: FanOutBus): void {
  const background = layerOf(bus, bus.masterId, 'background')
  copyRow(bus.db, 'layer', background.id, { id: 'M-logo', key: 'logo', slot: 'logo', z: 5 })
  bus.db.prepare("UPDATE layer SET type = 'image' WHERE id = 'M-logo'").run()
  setGeometry(bus, 'M-logo', layoutBoxOf(DEFAULT_STARTER_LAYOUT, { key: 'logo' }, SQUARE_PX))
  const headline = layerOf(bus, bus.masterId, 'headline')
  setGeometry(bus, headline.id, layoutBoxOf(TOP, { key: 'headline' }, SQUARE_PX))
}
