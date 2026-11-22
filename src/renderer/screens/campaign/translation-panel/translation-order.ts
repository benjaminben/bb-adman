// R3-3: the Translations tab in the Variants tab's order, so the two cannot drift apart. Rows go
// by the campaign's directions, then inside a direction in the order the Variants tab draws its
// grid (direction-order.ts laid out by grid-axes.ts: the master's size first, then the sizes
// order, image before video). A variant's own rows keep the order they came in (layer z). A post
// or a direction the campaign does not list goes after the listed ones. Pure.
import { directionOrder } from '@/renderer/screens/campaign/direction-grids/direction-order'
import { gridAxes } from '@/renderer/screens/campaign/variant-grid/grid-axes'
import type { CampaignGet } from '@/shared/schemas/queries/campaign'
import type { CampaignRow } from '@/shared/schemas/rows/campaign'

type Placed = { directionId: string; variantId: string }

export type DirectionRows<R> = { directionId: string; name: string; rows: R[] }

// Each variant's place in the Variants tab, over the whole campaign.
function places(data: CampaignGet): Map<string, number> {
  const ids = data.directions.flatMap((d) =>
    gridAxes(
      directionOrder(
        data.variants.filter((v) => v.directionId === d.id),
        data.campaign,
        d.masterVariantId,
      ),
    ).cells.flatMap((cell) => cell.variants.map((v) => v.id)),
  )
  return new Map(ids.map((id, i) => [id, i]))
}

export function byDirection<R extends Placed>(rows: R[], data: CampaignGet): DirectionRows<R>[] {
  const place = places(data)
  const rank = (row: R) => place.get(row.variantId) ?? place.size
  const sorted = rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => rank(a.row) - rank(b.row) || a.i - b.i)
  const groups = new Map<string, DirectionRows<R>>(
    data.directions.map((d) => [d.id, { directionId: d.id, name: d.name, rows: [] }]),
  )
  for (const { row } of sorted) {
    const group = groups.get(row.directionId) ?? {
      directionId: row.directionId,
      name: '',
      rows: [],
    }
    group.rows.push(row)
    groups.set(row.directionId, group)
  }
  return [...groups.values()].filter((g) => g.rows.length > 0)
}

// The primary language first, then the campaign's languages order, then any other in the order given.
export function languageOrder(
  languages: string[],
  campaign: Pick<CampaignRow, 'primaryLanguage' | 'languages'>,
): string[] {
  const listed = [campaign.primaryLanguage, ...campaign.languages]
  const place = (code: string) => {
    const i = listed.indexOf(code)
    return i === -1 ? listed.length : i
  }
  return languages
    .map((code, i) => ({ code, i }))
    .sort((a, b) => place(a.code) - place(b.code) || a.i - b.i)
    .map((x) => x.code)
}
