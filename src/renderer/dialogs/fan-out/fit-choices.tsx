// spec/screens-variants.md, "Fan-out" (A-145): for each ticked size of another pixel size, a
// group "Background for {label} ({width}×{height})" with three choices, Scale the default.
// DLG-4b (AP-5): the group shows the size's label and three icon choices; each radio keeps its
// words as its name and `title`, and as hidden text.
import { useId } from 'react'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import type { FanOutFit } from '@/shared/schemas/links'
import { Icon, type IconName } from '@/renderer/ui/icon'
import styles from './fan-out.module.css'

const FITS: Array<[FanOutFit, IconName, string]> = [
  ['scale', 'fit', 'Scale: show the whole picture, black at the edges'],
  ['crop', 'crop', 'Crop: fill the size and hide the edges'],
  ['fill', 'sparkle', 'Generate fill: extend the picture with AI'],
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
    <fieldset
      className={styles.fitRow}
      aria-label={`Background for ${sizeName(props.size)}`}
      disabled={props.disabled}
    >
      <span className={styles.fitLabel} aria-hidden="true">
        {props.size.label}
      </span>
      <div className={styles.fits}>
        {FITS.map(([fit, icon, words]) => (
          <div key={fit} className={styles.fit} title={words}>
            <input
              type="radio"
              id={`${name}-${fit}`}
              name={name}
              aria-label={words}
              title={words}
              checked={props.value === fit}
              onChange={() => props.onChange(fit)}
            />
            <label htmlFor={`${name}-${fit}`}>
              <Icon name={icon} />
              <span className={styles.hidden}>{words}</span>
            </label>
          </div>
        ))}
      </div>
    </fieldset>
  )
}

export function FitChoices(props: {
  sizes: CampaignSize[]
  fits: Readonly<Record<string, FanOutFit>>
  disabled: boolean
  onChange: (label: string, fit: FanOutFit) => void
}) {
  if (props.sizes.length === 0) return null
  return (
    <div className={styles.fitList}>
      {props.sizes.map((size) => (
        <FitGroup
          key={size.label}
          size={size}
          value={props.fits[size.label] ?? 'scale'}
          disabled={props.disabled}
          onChange={(fit) => props.onChange(size.label, fit)}
        />
      ))}
    </div>
  )
}
