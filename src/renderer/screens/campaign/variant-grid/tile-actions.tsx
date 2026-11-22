// P5-15 (spec/screens-variants.md, "The tile's actions"), as design wave CAMP-2 (AP-3, AP-8)
// draws them at the strip's right end: the eye "Quick look at {title}", always shown, then a
// More menu "{title}" with "Open", "Open in a tab", "Quick look" and, except on the master,
// "Delete…" [D-099], which only asks: the warning sends the delete. An item shows only when its
// action is given. The menu's keys live on the open menu, so the grid's arrows are left alone.
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { MoreMenu, type MoreItem } from '@/renderer/ui/more-menu'
import styles from './variant-grid.module.css'

export type TileActionsProps = {
  variant: VariantSummary
  onOpen?: (variantId: string) => void
  onOpenBehind?: (variantId: string) => void
  onQuickLook?: (variantId: string) => void
  onDelete?: (variantId: string) => void
  asked: () => void
}

function moreItems(props: TileActionsProps): MoreItem[] {
  const { variant: v, onOpen, onOpenBehind, onQuickLook, onDelete } = props
  const items: (MoreItem | false | undefined)[] = [
    onOpen && { id: 'open', label: 'Open', onChoose: () => onOpen(v.id) },
    onOpenBehind && { id: 'tab', label: 'Open in a tab', onChoose: () => onOpenBehind(v.id) },
    onQuickLook && { id: 'look', label: 'Quick look', onChoose: () => onQuickLook(v.id) },
    !!onDelete &&
      !v.isMaster && {
        id: 'delete',
        label: 'Delete…',
        danger: true,
        onChoose: () => {
          props.asked()
          onDelete(v.id)
        },
      },
  ]
  return items.filter((item): item is MoreItem => !!item)
}

export function TileActions(props: TileActionsProps) {
  const { variant: v, onQuickLook } = props
  const look = `Quick look at ${v.title}`
  const items = moreItems(props)
  if (!onQuickLook && items.length === 0) return null
  return (
    <span className={styles.actions}>
      {onQuickLook && (
        <button
          type="button"
          className={layout.iconButton}
          aria-label={look}
          title={look}
          onClick={() => onQuickLook(v.id)}
        >
          <Icon name="eye" size="small" />
        </button>
      )}
      {items.length > 0 && <MoreMenu label={v.title} items={items} />}
    </span>
  )
}
