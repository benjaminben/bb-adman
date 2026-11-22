// spec/editor.md, "Properties panel", Picture, background only (LK-5; ED-3): "Background
// colour", a SwatchField with the palette and no "No colour", its hint "Shows under the
// picture." in an InfoTip beside it. A layer with no colour counts as #000000, which is how it
// draws (A-72). Each change is one layer.update of fillColor, which is for the background layer
// only (A-73), so other layers show nothing here.
import { InfoTip } from '@/renderer/ui/info-tip'
import { SwatchField } from '@/renderer/ui/swatch-field'
import { pictureLookOf } from '@/shared/config/look'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { ImageStyle } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import styles from './background-colour-field.module.css'

export type BackgroundColourFieldProps = {
  layer: LayerRow
  palette: string[]
  // Resolves to the refusal message, or null when the change was saved.
  onUpdate: (patch: LayerPatch) => Promise<string | null>
}

const NO_COLOUR = '#000000'

export function BackgroundColourField(props: BackgroundColourFieldProps) {
  if (props.layer.type !== 'background') return null
  const stored = pictureLookOf(props.layer.style as ImageStyle).fillColor ?? NO_COLOUR
  return (
    <div className={styles.row}>
      <SwatchField
        label="Background colour"
        value={stored}
        palette={props.palette}
        disabled={props.layer.locked}
        onCommit={(value) => void props.onUpdate({ style: { fillColor: value ?? stored } })}
      />
      <InfoTip about="background colour">Shows under the picture.</InfoTip>
    </div>
  )
}
