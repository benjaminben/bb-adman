// The campaign's variants as a grid of tiles (spec/screens-campaign.md, "The campaign grid
// and the variant tile"), in the order campaign.get gives them. One grid for the whole
// campaign; one per direction comes with Phase 5. With onOpenBehind, each tile gets the "+"
// button that opens the variant's tab behind the overview (spec/editor.md, "Variant tabs").
// With projectId, each tile shows its thumbnail (spec/editor.md, "Thumbnails on the screens");
// its alt is empty, since the tile's own text names the variant. P5-14: label names the list
// ("Variants in {direction name}"); without it the list is "Variants".
// P5-15 (spec/screens-variants.md, "The tile's actions"): after the "+", "Quick look at
// {title}" and, except on the master, "Delete {title}". When a variant asked for deletion
// leaves the list while focus has nowhere to be, focus goes to the next tile's main button,
// else the previous one, else the direction's heading.
import { useLayoutEffect, useRef, type ReactNode, type RefObject } from 'react'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { VariantTile } from '@/renderer/screens/campaign/variant-tile'
import { Icon } from '@/renderer/ui/icon'
import { VariantThumbnail } from '@/renderer/ui/variant-thumbnail'
import layout from '@/renderer/ui/layout.module.css'
import styles from './variant-grid.module.css'

export type VariantGridProps = {
  projectId?: string
  label?: string
  variants: VariantSummary[]
  chosenId: string | null
  onChoose: (variantId: string) => void
  onOpenBehind?: (variantId: string) => void
  onQuickLook?: (variantId: string) => void
  onDelete?: (variantId: string) => void
  // AP-12: drawn under each tile, outside its button (the approval marks).
  tileFooter?: (variant: VariantSummary) => ReactNode
}

type Pending = { id: string; neighbours: string[] }

function focusHeading(from: HTMLElement | null) {
  const heading = from?.closest('section')?.querySelector<HTMLElement>('h2, h3')
  if (!heading) return
  if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1')
  heading.focus()
}

function useFocusAfterDelete(variants: VariantSummary[], root: RefObject<HTMLElement | null>) {
  const pending = useRef<Pending | null>(null)
  useLayoutEffect(() => {
    const asked = pending.current
    if (!asked || variants.some((v) => v.id === asked.id)) return
    pending.current = null
    const active = document.activeElement
    if (active && active !== document.body && active.isConnected) return
    const target = asked.neighbours.find((id) => variants.some((v) => v.id === id))
    const button = root.current?.querySelector<HTMLElement>(
      `[data-variant="${CSS.escape(target ?? '')}"] button`,
    )
    if (target && button) button.focus()
    else focusHeading(root.current)
  }, [variants, root])
  return (id: string) => {
    const i = variants.findIndex((v) => v.id === id)
    const neighbours = [variants[i + 1]?.id, variants[i - 1]?.id].filter((n) => n !== undefined)
    pending.current = { id, neighbours }
  }
}

function TileActions(props: VariantGridProps & { variant: VariantSummary; asked: () => void }) {
  const { variant: v, onOpenBehind, onQuickLook, onDelete } = props
  const look = `Quick look at ${v.title}`
  const remove = `Delete ${v.title}`
  if (!onOpenBehind && !onQuickLook && !onDelete) return null
  return (
    <span className={styles.actions}>
      {onOpenBehind && (
        <button
          type="button"
          aria-label={`Open ${v.title} in a tab`}
          onClick={() => onOpenBehind(v.id)}
        >
          +
        </button>
      )}
      {onQuickLook && (
        <button
          type="button"
          className={layout.iconOnly}
          aria-label={look}
          title={look}
          onClick={() => onQuickLook(v.id)}
        >
          <Icon name="eye" />
        </button>
      )}
      {onDelete && !v.isMaster && (
        <button
          type="button"
          className={layout.iconOnly}
          aria-label={remove}
          title={remove}
          onClick={() => {
            props.asked()
            onDelete(v.id)
          }}
        >
          <Icon name="trash" />
        </button>
      )}
    </span>
  )
}

export function VariantGrid(props: VariantGridProps) {
  const { projectId, tileFooter } = props
  const root = useRef<HTMLElement | null>(null)
  const askDelete = useFocusAfterDelete(props.variants, root)
  if (props.variants.length === 0) {
    return (
      <p ref={(el) => void (root.current = el)} className={layout.muted}>
        This campaign has no variants.
      </p>
    )
  }
  return (
    <ul
      ref={(el) => void (root.current = el)}
      aria-label={props.label ?? 'Variants'}
      className={styles.grid}
    >
      {props.variants.map((v) => (
        <li key={v.id} data-variant={v.id}>
          <VariantTile
            variant={v}
            chosen={v.id === props.chosenId}
            onChoose={props.onChoose}
            preview={
              projectId && (
                <VariantThumbnail projectId={projectId} variantId={v.id} rev={v.rev} alt="" />
              )
            }
            actions={<TileActions {...props} variant={v} asked={() => askDelete(v.id)} />}
            footer={tileFooter?.(v)}
          />
        </li>
      ))}
    </ul>
  )
}
