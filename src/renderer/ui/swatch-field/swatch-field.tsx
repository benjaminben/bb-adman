// spec/app-style-parts.md, "Field", "Swatch field" (design wave T3d): one row of round swatches,
// "No colour" first with `allowNone`, and "+" last, which opens a popover with "Hex colour" and
// the colour picker. A click on a swatch saves it. The part writes nothing itself: it calls
// onCommit with a #rrggbb value or null, and only when the choice differs from `value`.
import { useId, useRef, useState } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import { menuPlaceStyles } from '@/renderer/ui/menu-place'
import { HEX_COLOUR } from '@/shared/schemas/layer'
import { SwatchPopover } from './swatch-popover'
import styles from './swatch-field.module.css'

export type SwatchFieldProps = {
  label: string
  value: string | null
  palette: string[]
  allowNone?: boolean
  disabled?: boolean
  onCommit: (value: string | null) => void
}

const same = (a: string | null, b: string | null) =>
  a === null || b === null ? a === b : a.toLowerCase() === b.toLowerCase()

export function SwatchField(props: SwatchFieldProps) {
  const id = useId()
  const plus = useRef<HTMLButtonElement>(null)
  const [open, setOpen] = useState(false)

  function choose(value: string | null) {
    if (!same(value, props.value)) props.onCommit(value)
  }

  function close(focusBack: boolean) {
    setOpen(false)
    if (focusBack) plus.current?.focus()
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`} className={styles.field}>
      <span id={`${id}-label`} className={layout.label}>
        {props.label}
      </span>
      <div className={styles.row}>
        {props.allowNone && (
          <button
            type="button"
            className={`${styles.swatch} ${styles.none}`}
            aria-label="No colour"
            title="No colour"
            aria-pressed={props.value === null}
            disabled={props.disabled}
            onClick={() => choose(null)}
          >
            ⊘
          </button>
        )}
        {props.palette.map((hex) => (
          <button
            key={hex}
            type="button"
            className={styles.swatch}
            // Only an exact #rrggbb is drawn as CSS, so no other text reaches a style.
            style={HEX_COLOUR.test(hex) ? { background: hex } : undefined}
            aria-label={hex}
            title={hex}
            aria-pressed={same(hex, props.value)}
            disabled={props.disabled}
            onClick={() => choose(hex)}
          />
        ))}
        <div className={menuPlaceStyles.holder}>
          <button
            ref={plus}
            type="button"
            className={`${styles.swatch} ${styles.more}`}
            aria-label="Other colour"
            title="Other colour"
            aria-expanded={open}
            aria-controls={open ? `${id}-popover` : undefined}
            disabled={props.disabled}
            onClick={() => (open ? close(false) : setOpen(true))}
          >
            +
          </button>
          {open && (
            <SwatchPopover
              id={`${id}-popover`}
              value={props.value}
              trigger={plus}
              onCommit={(hex) => {
                choose(hex)
                close(true)
              }}
              onClose={close}
            />
          )}
        </div>
      </div>
    </div>
  )
}
