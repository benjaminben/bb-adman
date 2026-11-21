// The brief form's sizes (spec/screens-campaign.md, "The brief form", Sizes; FR-026): one box
// per ready-made size, the other sizes typed, and "Master size" among the chosen sizes in
// order. A ticked box goes to the end of the chosen sizes, so a brief's order is kept.
import { useId } from 'react'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import { READY_MADE_SIZES } from '@/shared/config/defaults'
import {
  masterOf,
  sizesInOrder,
  type SizeChoice,
} from '@/renderer/screens/project-home/brief-form-sizes'
import styles from './size-fields.module.css'

const isReadyMade = (label: string) => READY_MADE_SIZES.some((s) => s.label === label)

// "1x1 (1080×1080)" for a ready-made size, "1200×628" for any other.
export function sizeText(size: CampaignSize): string {
  const pixels = `${size.width}×${size.height}`
  return isReadyMade(size.label) ? `${size.label} (${pixels})` : pixels
}

export function SizeFields(props: { sizes: SizeChoice; onChange: (sizes: SizeChoice) => void }) {
  const { sizes } = props
  const hint = useId()
  const listed = sizesInOrder(sizes)
  const set = (patch: Partial<SizeChoice>) => props.onChange({ ...sizes, ...patch })
  const tick = (label: string, on: boolean) =>
    set({
      readyMade: on ? [...sizes.readyMade, label] : sizes.readyMade.filter((l) => l !== label),
    })

  return (
    <fieldset className={styles.sizes}>
      <legend>Sizes</legend>
      <div className={styles.ticks}>
        {READY_MADE_SIZES.map((s) => (
          <label key={s.label}>
            <input
              type="checkbox"
              checked={sizes.readyMade.includes(s.label)}
              onChange={(e) => tick(s.label, e.target.checked)}
            />
            {sizeText(s)}
          </label>
        ))}
      </div>
      <div className={styles.field}>
        <label className={styles.field}>
          Other sizes
          <input
            value={sizes.other}
            aria-describedby={hint}
            onChange={(e) => set({ other: e.target.value })}
          />
        </label>
        <p id={hint} className={styles.hint}>
          Ratios or pixel sizes, separated by commas, for example 4:5 or 1200x628.
        </p>
      </div>
      <label className={styles.field}>
        Master size
        <select
          value={masterOf(sizes) ?? ''}
          disabled={listed.length === 0}
          onChange={(e) => set({ master: e.target.value })}
        >
          {listed.map((s, i) => (
            <option key={i} value={s.label}>
              {sizeText(s)}
            </option>
          ))}
        </select>
      </label>
    </fieldset>
  )
}
