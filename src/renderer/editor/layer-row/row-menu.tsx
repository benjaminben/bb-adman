// ED-1a (choice C-3): a layer row's More menu. Duplicate, Bring forward, Send backward, then
// Delete after a separator. A disabled item gives its reason (architect's wording). The
// background row has no menu (the caller leaves it out).
import type { LayerRow as Layer } from '@/shared/schemas/rows/layer'
import { MoreMenu, type MoreItem } from '@/renderer/ui/more-menu'

export type RowMenuProps = {
  layer: Layer
  atFront: boolean
  atBack: boolean
  onDuplicate: () => void
  onForward: () => void
  onBackward: () => void
  onDelete: () => void
}

const LOCKED = 'Unlock the layer first'

function reason(locked: boolean, atEnd: boolean, end: string): string | undefined {
  if (locked) return LOCKED
  return atEnd ? end : undefined
}

export function RowMenu(props: RowMenuProps) {
  const { locked } = props.layer
  const forward = reason(locked, props.atFront, 'Already at the front')
  const backward = reason(locked, props.atBack, 'Already at the back')
  const remove = locked ? LOCKED : undefined
  const items: MoreItem[] = [
    { id: 'duplicate', label: 'Duplicate', icon: 'copy', onChoose: props.onDuplicate },
    {
      id: 'forward',
      label: 'Bring forward',
      disabled: forward !== undefined,
      reason: forward,
      onChoose: props.onForward,
    },
    {
      id: 'backward',
      label: 'Send backward',
      disabled: backward !== undefined,
      reason: backward,
      onChoose: props.onBackward,
    },
    {
      id: 'delete',
      label: 'Delete',
      icon: 'trash',
      danger: true,
      disabled: remove !== undefined,
      reason: remove,
      onChoose: props.onDelete,
    },
  ]
  return <MoreMenu label={props.layer.name} items={items} />
}
