// "Palette" of the rule set panel: one swatch per colour with its hex and "Remove", then a hex
// field and "Add colour", refused unless #RRGGBB. A swatch draws its entry as CSS, so an entry
// that is not an exact #RRGGBB (text a project file could hold) shows as words only.
import { useId, useState, type FormEvent } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import { HEX_COLOUR } from '@/shared/schemas/layer'
import { Refusal, RuleGroup } from './rule-group'
import styles from './rule-set-panel.module.css'

const BAD_HEX = 'Use a colour like #1A2B3C.'

export function PaletteList(props: {
  palette: string[]
  refusal: string | undefined
  onSave: (palette: string[]) => void
}) {
  const { palette } = props
  const fieldId = useId()
  const [hex, setHex] = useState('')
  const [bad, setBad] = useState(false)

  function add(event: FormEvent) {
    event.preventDefault()
    const value = hex.trim()
    if (!HEX_COLOUR.test(value)) return setBad(true)
    setBad(false)
    setHex('')
    if (palette.some((c) => c.toLowerCase() === value.toLowerCase())) return
    props.onSave([...palette, value])
  }

  return (
    <RuleGroup title="Palette">
      {palette.length === 0 ? (
        <p className={layout.muted}>No colours.</p>
      ) : (
        <ul className={`${layout.list} ${styles.items}`}>
          {palette.map((colour, i) => (
            <li key={`${i}-${colour}`} className={styles.item}>
              {HEX_COLOUR.test(colour) && (
                <span
                  data-testid="swatch"
                  aria-hidden="true"
                  className={styles.swatch}
                  style={{ backgroundColor: colour }}
                />
              )}
              <span className={styles.hex}>{colour}</span>
              <button
                type="button"
                className={`${layout.quiet} ${layout.small}`}
                aria-label={`Remove ${colour}`}
                onClick={() => props.onSave(palette.filter((_, j) => j !== i))}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
      <form className={styles.add} onSubmit={add}>
        <div className={layout.field}>
          <label htmlFor={fieldId}>Hex colour</label>
          <input
            id={fieldId}
            className={styles.hex}
            value={hex}
            placeholder="#1A2B3C"
            spellCheck={false}
            onChange={(e) => setHex(e.target.value)}
          />
        </div>
        <button type="submit">Add colour</button>
      </form>
      <Refusal message={bad ? BAD_HEX : props.refusal} />
    </RuleGroup>
  )
}
