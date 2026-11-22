// "Palette" of the Rules section: one swatch chip per colour with an always-shown ✕ "Remove
// {hex}", then a "+" named "Add colour" that opens the "Hex colour" field (Enter adds, Escape
// shuts it). A value that is not #RRGGBB is refused with its message under the row and the
// typed text kept. A swatch draws its entry as CSS only when it is an exact #RRGGBB (text a
// project file could hold); any other entry shows as words.
import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { HEX_COLOUR } from '@/shared/schemas/layer'
import { Refusal, RuleGroup } from './rule-group'
import styles from './rule-set-panel.module.css'

const BAD_HEX = 'Use a colour like #1A2B3C.'

function Chip(props: { colour: string; onRemove: () => void }) {
  const { colour } = props
  const drawn = HEX_COLOUR.test(colour)
  return (
    <li className={styles.chip} title={colour}>
      {drawn && (
        <span
          data-testid="swatch"
          aria-hidden="true"
          className={styles.swatch}
          style={{ backgroundColor: colour }}
        />
      )}
      <span className={drawn ? styles.hidden : styles.hex}>{colour}</span>
      <button
        type="button"
        className={`${layout.iconButton} ${styles.remove}`}
        aria-label={`Remove ${colour}`}
        title={`Remove ${colour}`}
        onClick={props.onRemove}
      >
        <Icon name="x" />
      </button>
    </li>
  )
}

export function PaletteList(props: {
  palette: string[]
  refusal: string | undefined
  onSave: (palette: string[]) => void
}) {
  const { palette } = props
  const plus = useRef<HTMLButtonElement>(null)
  const [adding, setAdding] = useState(false)
  const [hex, setHex] = useState('')
  const [bad, setBad] = useState(false)

  function shut() {
    setAdding(false)
    setBad(false)
    setHex('')
    plus.current?.focus()
  }

  function add(event: FormEvent) {
    event.preventDefault()
    const value = hex.trim()
    if (!HEX_COLOUR.test(value)) return setBad(true)
    shut()
    if (palette.some((c) => c.toLowerCase() === value.toLowerCase())) return
    props.onSave([...palette, value])
  }

  function key(event: KeyboardEvent) {
    if (event.key !== 'Escape') return
    event.stopPropagation()
    shut()
  }

  return (
    <RuleGroup title="Palette">
      <div className={styles.row}>
        <ul className={`${layout.list} ${styles.chips}`} aria-label="Colours">
          {palette.map((colour, i) => (
            <Chip
              key={`${i}-${colour}`}
              colour={colour}
              onRemove={() => props.onSave(palette.filter((_, j) => j !== i))}
            />
          ))}
        </ul>
        <button
          ref={plus}
          type="button"
          className={`${layout.iconButton} ${styles.plus}`}
          aria-label="Add colour"
          title="Add colour"
          aria-expanded={adding}
          onClick={() => (adding ? shut() : setAdding(true))}
        >
          <Icon name="plus" />
        </button>
        {adding && (
          <form className={styles.add} onSubmit={add}>
            <input
              aria-label="Hex colour"
              className={styles.hexField}
              value={hex}
              placeholder="#1A2B3C"
              spellCheck={false}
              autoFocus
              onKeyDown={key}
              onChange={(e) => setHex(e.target.value)}
            />
          </form>
        )}
      </div>
      <Refusal message={bad ? BAD_HEX : props.refusal} />
    </RuleGroup>
  )
}
