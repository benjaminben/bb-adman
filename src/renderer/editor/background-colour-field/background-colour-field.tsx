// spec/editor.md, "Properties panel", Picture, background only (LK-5): "Background colour", a
// colour-choice with the palette and no "None", hinted "Shows under the picture." A layer with
// no colour shows #000000, which is how it draws (A-72). Each change is one layer.update of
// fillColor, which is for the background layer only (A-73), so other layers show nothing here.
// Its look is the colour-choice's own, so it has no styles of its own.
import { ColourChoice } from '@/renderer/editor/colour-choice'
import { pictureLookOf } from '@/shared/config/look'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { ImageStyle } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'

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
    <ColourChoice
      label="Background colour"
      value={stored}
      palette={props.palette}
      disabled={props.layer.locked}
      hint="Shows under the picture."
      onCommit={(value) => props.onUpdate({ style: { fillColor: value ?? stored } })}
    />
  )
}
