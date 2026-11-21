// spec/editor.md, "Properties panel", "Position and size": X, Y, W, H (px) and Rotation (°) for
// every layer, the keyboard path for every canvas action [REQ: 8.6]. Each field saves one
// layer.update with only its own geometry field. Width and height are at least 1 px.
import type { Geometry } from '@/shared/schemas/layer'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import { NumberField } from '@/renderer/editor/number-field'
import styles from './geometry-fields.module.css'

export type GeometryFieldsProps = {
  geometry: Geometry
  disabled: boolean
  onUpdate: (patch: LayerPatch) => Promise<string | null>
}

type Key = 'x' | 'y' | 'width' | 'height' | 'rotation'

const FIELDS: Array<{ key: Key; label: string; name?: string; unit: string; min?: number }> = [
  { key: 'x', label: 'X', unit: 'px' },
  { key: 'y', label: 'Y', unit: 'px' },
  { key: 'width', label: 'W', name: 'Width', unit: 'px', min: 1 },
  { key: 'height', label: 'H', name: 'Height', unit: 'px', min: 1 },
  { key: 'rotation', label: 'Rotation', unit: '°' },
]

export function GeometryFields(props: GeometryFieldsProps) {
  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>Position and size</legend>
      <div className={styles.grid}>
        {FIELDS.map((f) => (
          <NumberField
            key={f.key}
            label={f.label}
            name={f.name}
            unit={f.unit}
            min={f.min}
            value={props.geometry[f.key]}
            disabled={props.disabled}
            onCommit={(value) => props.onUpdate({ geometry: { [f.key]: value } })}
          />
        ))}
      </div>
    </fieldset>
  )
}
