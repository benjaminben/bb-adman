// ED-2 (spec/phases/design-wave-screens-a.md, "Text layer"): the "Type" Section, open, its
// summary "{font} · {weight} · {size}". In order: the font slot (select, Upload font…, and on a
// translated layer "All {lang} posts"), the built-in styles while the project has no fonts,
// Size and Weight, Align and Vertical align, Colour, Line height, Letter spacing and All
// capitals. A locked layer disables the whole group. A refusal shows under the rows.
import { useState, type ReactNode } from 'react'
import { FontNameContext } from '@/renderer/editor/font-field'
import { TypeStyles } from '@/renderer/editor/type-styles'
import { Section } from '@/renderer/ui/section'
import { textLookOf } from '@/shared/config/look'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import type { TextStyle } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { AlignRow, ColourRow, SizeWeightRow, SpacingRow } from './type-rows'
import { weightName } from './weights'
import styles from './text-fields.module.css'

type Props = {
  layer: LayerRow
  palette: string[]
  font: ReactNode
  onUpdate: (patch: LayerPatch) => Promise<string | null>
}

export function TypeSection(props: Props) {
  const { layer } = props
  const look = textLookOf(layer.style as TextStyle)
  const [fontName, setFontName] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const set = (values: Partial<TextStyle>) => props.onUpdate({ style: values })
  const send = (values: Partial<TextStyle>) => void set(values).then(setError)
  const font = look.fontAssetId === null ? 'Inter' : fontName
  const summary = [font, weightName(look.fontWeight), look.fontSize].filter(Boolean).join(' · ')
  const rows = { look, set, send }

  return (
    <Section id="props.type" title="Type" level={4} summary={summary}>
      <fieldset aria-label="Type" className={styles.group} disabled={layer.locked}>
        <FontNameContext.Provider value={setFontName}>{props.font}</FontNameContext.Provider>
        <TypeStyles layer={layer} onUpdate={props.onUpdate} />
        <SizeWeightRow {...rows} />
        <AlignRow {...rows} />
        <ColourRow {...rows} palette={props.palette} />
        <SpacingRow {...rows} />
        {error && (
          <p role="alert" className={styles.error}>
            {error}
          </p>
        )}
      </fieldset>
    </Section>
  )
}
