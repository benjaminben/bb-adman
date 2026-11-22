// P5-15 (spec/screens-variants.md, "The tile's actions"): after the "+", "Quick look at
// {title}" and, except on the master, "Delete {title}".
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './variant-grid.module.css'

export type TileActionsProps = {
  variant: VariantSummary
  onOpenBehind?: (variantId: string) => void
  onQuickLook?: (variantId: string) => void
  onDelete?: (variantId: string) => void
  asked: () => void
}

export function TileActions(props: TileActionsProps) {
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
