// spec/editor.md, "Properties panel", "Position and size": X, Y, W, H and Rotation (°) for every
// layer, the keyboard path for every canvas action [REQ: 8.6]. Each field saves one layer.update
// with only its own geometry field. Width and height are at least 1 px. ED-1b: a Section
// "Position", folded at first, whose summary is "{x}, {y}"; X, Y, W and H share one row, each
// short label at its box's left; the row keeps the group name "Position and size" (the name
// rule: the visible "Position" is part of it).
import type { Geometry } from '@/shared/schemas/layer'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import { NumberField } from '@/renderer/editor/number-field'
import { Section } from '@/renderer/ui/section'
import styles from './geometry-fields.module.css'

export type GeometryFieldsProps = {
  geometry: Geometry
  disabled: boolean
  onUpdate: (patch: LayerPatch) => Promise<string | null>
}

type Key = 'x' | 'y' | 'width' | 'height'

const BOX: Array<{ key: Key; label: string; name?: string; min?: number }> = [
  { key: 'x', label: 'X' },
  { key: 'y', label: 'Y' },
  { key: 'width', label: 'W', name: 'Width', min: 1 },
  { key: 'height', label: 'H', name: 'Height', min: 1 },
]

export function GeometryFields(props: GeometryFieldsProps) {
  const { geometry } = props
  const summary = `${Math.round(geometry.x)}, ${Math.round(geometry.y)}`
  return (
    <Section id="props.position" title="Position" level={4} fold="closed" summary={summary}>
      <div role="group" aria-label="Position and size" className={`${styles.grid} ${styles.boxes}`}>
        {BOX.map((f) => (
          <NumberField
            key={f.key}
            inline
            label={f.label}
            name={f.name}
            min={f.min}
            value={geometry[f.key]}
            disabled={props.disabled}
            onCommit={(value) => props.onUpdate({ geometry: { [f.key]: value } })}
          />
        ))}
      </div>
      <NumberField
        inline
        label="Rotation"
        unit="°"
        value={geometry.rotation}
        disabled={props.disabled}
        onCommit={(rotation) => props.onUpdate({ geometry: { rotation } })}
      />
    </Section>
  )
}
