// AST-1 (spec/phases/design-wave-screens-b.md, "AST-1"): a clip, font or other file of the
// Assets panel as an ObjectRow: the kind's icon, the display name, the detail line, the marks.
// The row has no action of its own, so its cover button is hidden from the keyboard and screen
// readers (as SET-2's key rows); the words are read from the row. Only the picked view reaches
// this row, so no path can be drawn.
import type { AssetView } from '@/renderer/screens/assets/assets-panel/asset-view'
import { Icon } from '@/renderer/ui/icon'
import { ObjectRow } from '@/renderer/ui/object-row'
import { AssetMarks, KIND_ICONS, assetDetail, hasMarks } from './asset-marks'

const COVER = { tabIndex: -1, 'aria-hidden': true } as const

export function AssetRow({ asset }: { asset: AssetView }) {
  const detail = assetDetail(asset)
  return (
    <li>
      <ObjectRow
        name={asset.displayName}
        label={asset.displayName}
        thumb={<Icon name={KIND_ICONS[asset.kind]} />}
        meta={detail ?? undefined}
        marks={hasMarks(asset) ? <AssetMarks asset={asset} /> : undefined}
        mainProps={COVER}
      />
    </li>
  )
}
