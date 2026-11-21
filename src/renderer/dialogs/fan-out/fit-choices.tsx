// spec/screens-variants.md, "Fan-out": the dialog's choice groups. The sizes and languages as
// ticks, the master's ticked and fixed; and (A-145) for each ticked size of another pixel size,
// a group "Background for {label} ({width}×{height})" with three choices, Scale the default.
import { useId } from 'react'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import type { FanOutFit } from '@/shared/schemas/links'
import styles from './fan-out.module.css'

const FITS: Array<[FanOutFit, string]> = [
  ['scale', 'Scale: show the whole picture, black at the edges'],
  ['crop', 'Crop: fill the size and hide the edges'],
  ['fill', 'Generate fill: extend the picture with AI'],
]

export const sizeName = (s: CampaignSize) => `${s.label} (${s.width}×${s.height})`

function FitGroup(props: {
  size: CampaignSize
  value: FanOutFit
  disabled: boolean
  onChange: (fit: FanOutFit) => void
}) {
  const name = useId()
  return (
    <fieldset className={styles.group} disabled={props.disabled}>
      <legend>Background for {sizeName(props.size)}</legend>
      {FITS.map(([fit, words]) => (
        <div key={fit} className={styles.choice}>
          <input
            type="radio"
            id={`${name}-${fit}`}
            name={name}
            checked={props.value === fit}
            onChange={() => props.onChange(fit)}
          />
          <label htmlFor={`${name}-${fit}`}>{words}</label>
        </div>
      ))}
    </fieldset>
  )
}

export function FitChoices(props: {
  sizes: CampaignSize[]
  fits: Readonly<Record<string, FanOutFit>>
  disabled: boolean
  onChange: (label: string, fit: FanOutFit) => void
}) {
  return (
    <>
      {props.sizes.map((size) => (
        <FitGroup
          key={size.label}
          size={size}
          value={props.fits[size.label] ?? 'scale'}
          disabled={props.disabled}
          onChange={(fit) => props.onChange(size.label, fit)}
        />
      ))}
    </>
  )
}

export function TickGroup(props: {
  legend: string
  items: Array<{ id: string; label: string; fixed: boolean }>
  ticked: string[]
  disabled: boolean
  onChange: (ticked: string[]) => void
}) {
  const flip = (id: string, on: boolean) =>
    props.onChange(on ? [...props.ticked, id] : props.ticked.filter((t) => t !== id))
  return (
    <fieldset className={styles.group} disabled={props.disabled}>
      <legend>{props.legend}</legend>
      {props.items.map((item) => (
        <label key={item.id} className={styles.choice}>
          <input
            type="checkbox"
            checked={item.fixed || props.ticked.includes(item.id)}
            disabled={item.fixed}
            onChange={(e) => flip(item.id, e.target.checked)}
          />
          {item.label}
        </label>
      ))}
    </fieldset>
  )
}
