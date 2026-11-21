// spec/editor.md, "Layer list": a row's buttons. "Hide {name}" / "Show {name}" and "Lock {name}" /
// "Unlock {name}" (aria-pressed), and "Delete {name}", which the background and a locked layer do
// not have. They show while the row is selected, pointed at or holds the focus; otherwise only a
// hidden or locked state shows, so the list stays quiet and the state is still seen.
import type { LayerRow as Layer } from '@/shared/schemas/rows/layer'
import styles from './layer-row.module.css'

export type RowActionsProps = {
  layer: Layer
  active: boolean
  onToggle: (patch: { visible?: boolean; locked?: boolean }) => void
  onDelete: () => void
}

export function RowActions({ layer, active, onToggle, onDelete }: RowActionsProps) {
  const hidden = !layer.visible
  const canDelete = layer.type !== 'background' && !layer.locked
  if (!active && !hidden && !layer.locked) return null
  return (
    <span className={styles.actions}>
      {(active || hidden) && (
        <button
          type="button"
          className={styles.action}
          aria-label={`${hidden ? 'Show' : 'Hide'} ${layer.name}`}
          aria-pressed={hidden}
          onClick={() => onToggle({ visible: hidden })}
        >
          {hidden ? 'Show' : 'Hide'}
        </button>
      )}
      {(active || layer.locked) && (
        <button
          type="button"
          className={styles.action}
          aria-label={`${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`}
          aria-pressed={layer.locked}
          onClick={() => onToggle({ locked: !layer.locked })}
        >
          {layer.locked ? 'Unlock' : 'Lock'}
        </button>
      )}
      {active && canDelete && (
        <button
          type="button"
          className={styles.action}
          aria-label={`Delete ${layer.name}`}
          onClick={onDelete}
        >
          Delete
        </button>
      )}
    </span>
  )
}
