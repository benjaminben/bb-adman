// spec/editor.md, "Layer list": a row's state buttons, "Hide {name}" / "Show {name}" and
// "Lock {name}" / "Unlock {name}" (aria-pressed). ED-1a (AP-12): both always show, muted when
// off and in the accent ink when pressed (ObjectRow's state actions).
import type { LayerRow as Layer } from '@/shared/schemas/rows/layer'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'

export type RowActionsProps = {
  layer: Layer
  onToggle: (patch: { visible?: boolean; locked?: boolean }) => void
}

// Icon-only; each keeps its accessible name, shown again as a tooltip.
export function RowActions({ layer, onToggle }: RowActionsProps) {
  const hidden = !layer.visible
  const hideName = `${hidden ? 'Show' : 'Hide'} ${layer.name}`
  const lockName = `${layer.locked ? 'Unlock' : 'Lock'} ${layer.name}`
  return (
    <>
      <button
        type="button"
        className={layout.iconButton}
        aria-label={hideName}
        title={hideName}
        aria-pressed={hidden}
        onClick={() => onToggle({ visible: hidden })}
      >
        <Icon name={hidden ? 'eyeOff' : 'eye'} size="small" />
      </button>
      <button
        type="button"
        className={layout.iconButton}
        aria-label={lockName}
        title={lockName}
        aria-pressed={layer.locked}
        onClick={() => onToggle({ locked: !layer.locked })}
      >
        <Icon name="lock" size="small" />
      </button>
    </>
  )
}
