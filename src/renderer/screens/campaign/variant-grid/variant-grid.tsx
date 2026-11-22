// The campaign's variants as a grid of tiles (spec/screens-campaign.md, "The campaign grid
// and the variant tile"). With onOpenBehind, each tile gets the "+" button that opens the
// variant's tab behind the overview (spec/editor.md, "Variant tabs"). With projectId, each tile
// shows its thumbnail (spec/editor.md, "Thumbnails on the screens"); its alt is empty, since the
// tile's own text names the variant. P5-14: label names the list ("Variants in {direction
// name}"); without it the list is "Variants". P5-15: the tile's actions (tile-actions.tsx) and
// focus after a delete (use-focus-after-delete.ts).
// R2C-2 (spec/phases/round-2-campaign.md, design addition 2): a table with sizes as rows and
// languages as columns, in the order of the list given, so the master sits top left. The list
// holds one item per occupied cell in reading order; an image and a video of one size and
// language share a cell. A row never wraps: the box scrolls sideways (A-310).
// R2C-3 (design addition 3): onOpen opens a tile (double-click, Enter); the list's keys move the
// selection and ask to delete (use-grid-keys.ts).
import { useRef, type ReactNode } from 'react'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { VariantTile } from '@/renderer/screens/campaign/variant-tile'
import { VariantThumbnail } from '@/renderer/ui/variant-thumbnail'
import layout from '@/renderer/ui/layout.module.css'
import { gridAxes } from './grid-axes'
import { GridHeads } from './grid-heads'
import { TileActions } from './tile-actions'
import { useGridKeys } from './use-grid-keys'
import { useFocusAfterDelete } from './use-focus-after-delete'
import styles from './variant-grid.module.css'

export type VariantGridProps = {
  projectId?: string
  label?: string
  variants: VariantSummary[]
  chosenId: string | null
  onChoose: (variantId: string) => void
  onOpen?: (variantId: string) => void
  onOpenBehind?: (variantId: string) => void
  onQuickLook?: (variantId: string) => void
  onDelete?: (variantId: string) => void
  // AP-12: drawn under each tile, outside its button (the approval marks).
  tileFooter?: (variant: VariantSummary) => ReactNode
}

function Tile(props: VariantGridProps & { variant: VariantSummary; asked: () => void }) {
  const { variant: v, projectId } = props
  return (
    <div data-variant={v.id}>
      <VariantTile
        variant={v}
        chosen={v.id === props.chosenId}
        onChoose={props.onChoose}
        onOpen={props.onOpen}
        onOpenBehind={props.onOpenBehind}
        preview={
          projectId && (
            <VariantThumbnail projectId={projectId} variantId={v.id} rev={v.rev} alt="" />
          )
        }
        actions={
          <TileActions
            variant={v}
            onOpenBehind={props.onOpenBehind}
            onQuickLook={props.onQuickLook}
            onDelete={props.onDelete}
            asked={props.asked}
          />
        }
        footer={props.tileFooter?.(v)}
      />
    </div>
  )
}

export function VariantGrid(props: VariantGridProps) {
  const root = useRef<HTMLElement | null>(null)
  const askDelete = useFocusAfterDelete(props.variants, root)
  const { onDelete } = props
  const axes = gridAxes(props.variants)
  const onKeyDown = useGridKeys(axes, {
    onChoose: props.onChoose,
    onDelete:
      onDelete &&
      ((id) => {
        askDelete(id)
        onDelete(id)
      }),
  })
  if (props.variants.length === 0) {
    return (
      <p ref={(el) => void (root.current = el)} className={layout.muted}>
        This campaign has no variants.
      </p>
    )
  }
  const { rows, columns, cells } = axes
  const tracks = {
    gridTemplateColumns: `max-content repeat(${columns.length}, var(--thumbnail-tile))`,
    gridTemplateRows: `repeat(${rows.length + 1}, auto)`,
  }
  return (
    <div className={styles.scroll}>
      <div className={styles.table} style={tracks}>
        <GridHeads rows={rows} columns={columns} />
        <ul
          ref={(el) => void (root.current = el)}
          aria-label={props.label ?? 'Variants'}
          className={styles.cells}
          onKeyDown={onKeyDown}
        >
          {cells.map((cell) => (
            <li
              key={`${cell.row}:${cell.column}`}
              className={styles.cell}
              style={{ gridRow: cell.row, gridColumn: cell.column }}
            >
              {cell.variants.map((v) => (
                <Tile key={v.id} {...props} variant={v} asked={() => askDelete(v.id)} />
              ))}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
