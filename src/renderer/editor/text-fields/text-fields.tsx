// spec/editor.md, "Properties panel", "Text" [REQ: FR-093, FR-249]: Copy, then the font field
// (given by the panel), Size, Weight, Colour, Align, Line height and Letter spacing, and the line
// "This text does not fit its box." when it overflows. It is never shrunk for the user.
import { useId, type ReactNode } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import { NumberField } from '@/renderer/editor/number-field'
import { TranslationStatus } from '@/renderer/editor/translation-status'
import type { LayerPatch } from '@/shared/schemas/commands/layer'
import layout from '@/renderer/ui/layout.module.css'
import type { TextStyle } from '@/shared/schemas/layer'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import { ColourField } from './colour-field'
import { CopyField } from './copy-field'
import { SuggestCopy } from './suggest-copy'
import styles from './text-fields.module.css'

export type TextFieldsProps = {
  layer: LayerRow
  palette: string[]
  font: ReactNode
  onUpdate: (patch: LayerPatch) => Promise<string | null>
}

const WEIGHTS: Array<[number, string]> = [
  [100, 'Thin'],
  [200, 'Extra light'],
  [300, 'Light'],
  [400, 'Regular'],
  [500, 'Medium'],
  [600, 'Semibold'],
  [700, 'Bold'],
  [800, 'Extra bold'],
  [900, 'Black'],
]

const ALIGN: Array<[TextStyle['align'], string]> = [
  ['left', 'Left'],
  ['center', 'Centre'],
  ['right', 'Right'],
]

// P6-14 (A-162): a translated text's Copy sends translation.set for the shown project, and its
// status line sits under it.
function TranslatedCopy(props: { layer: LayerRow }) {
  const { layer } = props
  const api = useApi()
  const projectId = useApp((s) => (s.view.kind === 'project' ? s.view.projectId : null))
  if (projectId === null) return null
  async function commit(text: string): Promise<string | null> {
    const input = { projectId, layerId: layer.id, text, applyToSameLanguage: false }
    const result = await api.command('translation.set', input)
    return result.ok ? null : result.error.message
  }
  return (
    <>
      <CopyField
        copy={layer.copy ?? ''}
        disabled={layer.locked}
        action={<SuggestCopy layer={layer} />}
        onCommit={commit}
      />
      <TranslationStatus projectId={projectId} layer={layer} />
    </>
  )
}

export function TextFields(props: TextFieldsProps) {
  const { layer } = props
  const style = layer.style as TextStyle
  const disabled = layer.locked
  const weightId = useId()
  const set = (values: Partial<TextStyle>) => props.onUpdate({ style: values })

  return (
    <fieldset className={styles.section}>
      <legend className={styles.legend}>Text settings</legend>
      {layer.translationStatus === null ? (
        <CopyField
          copy={layer.copy ?? ''}
          disabled={disabled}
          action={<SuggestCopy layer={layer} />}
          onCommit={(copy) => props.onUpdate({ copy })}
        />
      ) : (
        <TranslatedCopy layer={layer} />
      )}
      {props.font}
      <div className={styles.pair}>
        <NumberField
          label="Size"
          unit="px"
          min={1}
          value={style.fontSize}
          disabled={disabled}
          onCommit={(fontSize) => set({ fontSize })}
        />
        <div className={styles.field}>
          <label className={styles.label} htmlFor={weightId}>
            Weight
          </label>
          <select
            id={weightId}
            aria-describedby={`${weightId}-hint`}
            disabled={disabled}
            value={style.fontWeight}
            onChange={(event) => void set({ fontWeight: Number(event.target.value) })}
          >
            {WEIGHTS.map(([weight, name]) => (
              <option key={weight} value={weight}>{`${name} ${weight}`}</option>
            ))}
          </select>
        </div>
      </div>
      <p id={`${weightId}-hint`} className={styles.hint}>
        Weight changes only fonts that have more than one weight.
      </p>
      <ColourField
        color={style.color}
        palette={props.palette}
        disabled={disabled}
        onCommit={(color) => set({ color })}
      />
      <div role="group" aria-label="Align" className={`${layout.seg} ${styles.align}`}>
        {ALIGN.map(([align, name]) => (
          <button
            key={align}
            type="button"
            aria-pressed={style.align === align}
            disabled={disabled}
            onClick={() => void set({ align })}
          >
            {name}
          </button>
        ))}
      </div>
      <div className={styles.pair}>
        <NumberField
          label="Line height"
          step={0.05}
          min={0.5}
          max={4}
          value={style.lineHeight}
          disabled={disabled}
          onCommit={(lineHeight) => set({ lineHeight })}
        />
        <NumberField
          label="Letter spacing"
          unit="em"
          step={0.01}
          min={-0.2}
          max={1}
          value={style.letterSpacing}
          disabled={disabled}
          onCommit={(letterSpacing) => set({ letterSpacing })}
        />
      </div>
      {layer.overflow && <p className={styles.overflow}>This text does not fit its box.</p>}
    </fieldset>
  )
}
