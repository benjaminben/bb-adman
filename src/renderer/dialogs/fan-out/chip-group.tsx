// DLG-4b (AP-5, AP-6): the fan-out dialog's Sizes, Languages and Formats as toggle chips in a
// fieldset named by its legend. Each chip is a button with `aria-pressed`, named by `name`; a
// size chip draws its shape. A fixed chip (the master's) is pressed and disabled; with `keepOne`
// the last chip on cannot be turned off: it stays in the tab order, `aria-disabled`, so the
// keyboard still reaches it. A chip that cannot change gives its reason in `title`.
import type { ReactNode } from 'react'
import styles from './fan-out.module.css'

export type Chip = {
  id: string
  name: string
  label: ReactNode
  title?: string
  fixed?: string
}

type Props = {
  legend: string
  chips: Chip[]
  on: string[]
  disabled: boolean
  keepOne?: string
  onChange: (on: string[]) => void
}

export function ChipGroup(props: Props) {
  const { on } = props
  const flip = (id: string) =>
    props.onChange(on.includes(id) ? on.filter((t) => t !== id) : [...on, id])
  return (
    <fieldset className={styles.group} disabled={props.disabled}>
      <legend>{props.legend}</legend>
      <div className={styles.chips}>
        {props.chips.map((chip) => {
          const pressed = chip.fixed !== undefined || on.includes(chip.id)
          const last = props.keepOne !== undefined && pressed && on.length === 1
          const reason = chip.fixed ?? (last ? props.keepOne : undefined)
          return (
            <button
              key={chip.id}
              type="button"
              className={styles.chip}
              aria-label={chip.name === chip.label ? undefined : chip.name}
              aria-pressed={pressed}
              disabled={chip.fixed !== undefined}
              aria-disabled={last || undefined}
              title={reason ?? chip.title}
              onClick={() => !last && flip(chip.id)}
            >
              {chip.label}
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}

// A size's chip face: its shape, scaled to fit the chip, then its label.
export function SizeFace(props: { label: string; width: number; height: number }) {
  return (
    <>
      <span
        className={styles.shape}
        style={{ aspectRatio: `${props.width} / ${props.height}` }}
        aria-hidden="true"
      />
      {props.label}
    </>
  )
}
