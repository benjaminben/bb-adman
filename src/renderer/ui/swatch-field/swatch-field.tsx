// spec/app-style-parts.md, "Field", "Swatch field" (design wave T3d, D-109): one row of round
// swatches, "No colour" first with `allowNone`, and "+" last. A click on a swatch that is not
// the chosen one saves it; the chosen swatch and "+" open the app's own colour picker. The
// part writes nothing itself: it calls onCommit with a #rrggbb value or null, and only when
// the choice differs from `value`.
import { useEffect, useId, useRef, useState } from 'react'
import { Icon } from '@/renderer/ui/icon'
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

type Opener = 'chosen' | 'plus'

const same = (a: string | null, b: string | null) =>
  a === null || b === null ? a === b : a.toLowerCase() === b.toLowerCase()

export function SwatchField(props: SwatchFieldProps) {
  const id = useId()
  const holder = useRef<HTMLDivElement>(null)
  const plus = useRef<HTMLButtonElement>(null)
  const chosen = useRef<HTMLButtonElement>(null)
  const [openedBy, setOpenedBy] = useState<Opener | null>(null)
  const open = openedBy !== null

  function save(value: string | null) {
    if (!same(value, props.value)) props.onCommit(value)
  }

  // The focus goes back after the popover has gone, so a saved colour's swatch is the one
  // that takes it when the chosen swatch opened the popover.
  const refocus = useRef<Opener | null>(null)
  useEffect(() => {
    if (refocus.current === null) return
    const opener = refocus.current === 'chosen' ? chosen : plus
    refocus.current = null
    opener.current?.focus()
  })

  function close(focusBack: boolean) {
    if (focusBack) refocus.current = openedBy
    setOpenedBy(null)
  }

  const toggle = (by: Opener) => (open ? close(false) : setOpenedBy(by))

  // The current colour is always on show: one the palette lacks follows it.
  const { value } = props
  const extra =
    value !== null && HEX_COLOUR.test(value) && !props.palette.some((p) => same(p, value))
  const swatches = extra ? [...props.palette, value] : props.palette

  // The chosen swatch opens the picker; any other saves its colour.
  function pick(choice: string | null) {
    if (same(choice, props.value)) toggle('chosen')
    else save(choice)
  }

  return (
    <div role="group" aria-labelledby={`${id}-label`} className={styles.field}>
      <span id={`${id}-label`} className={layout.label}>
        {props.label}
      </span>
      <div ref={holder} className={menuPlaceStyles.holder}>
        <div className={styles.row}>
          {props.allowNone && (
            <button
              ref={value === null ? chosen : undefined}
              type="button"
              aria-pressed={value === null}
              disabled={props.disabled}
              onClick={() => pick(null)}
              className={`${styles.swatch} ${styles.none}`}
              aria-label="No colour"
              title="No colour"
            >
              ⊘
            </button>
          )}
          {swatches.map((hex) => (
            <button
              key={hex}
              ref={same(hex, value) ? chosen : undefined}
              type="button"
              aria-pressed={same(hex, value)}
              disabled={props.disabled}
              onClick={() => pick(hex)}
              className={styles.swatch}
              // Only an exact #rrggbb is drawn as CSS, so no other text reaches a style.
              style={HEX_COLOUR.test(hex) ? { background: hex } : undefined}
              aria-label={hex}
              title={hex}
            />
          ))}
          <button
            ref={plus}
            type="button"
            className={`${styles.swatch} ${styles.more}`}
            aria-label="Other colour"
            title="Other colour"
            aria-expanded={open}
            aria-controls={open ? `${id}-popover` : undefined}
            disabled={props.disabled}
            onClick={() => toggle('plus')}
          >
            <Icon name="plus" size="small" />
          </button>
        </div>
        {open && (
          <SwatchPopover
            id={`${id}-popover`}
            value={props.value}
            anchor={holder}
            openers={[chosen, plus]}
            onSave={save}
            onClose={close}
          />
        )}
      </div>
    </div>
  )
}
