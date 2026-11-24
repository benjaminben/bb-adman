// "Ad sets" (spec/brief-brand.md, "Ad sets"): a segment pair under "Place first photo",
// "Together" | "Per subject". The form draws it only with two or more subject rows; with one
// row it is hidden and the value is kept.
import type { AdsPer } from '@/shared/brief/brand'
import layout from '@/renderer/ui/layout.module.css'
import styles from './brand-fields.module.css'

const CHOICES = [
  { value: 'campaign', text: 'Together', name: 'One set of ads for all subjects' },
  { value: 'subject', text: 'Per subject', name: 'One set of ads per subject' },
] as const

export function AdsPerField(props: { value: AdsPer; onChange: (value: AdsPer) => void }) {
  return (
    <div className={styles.part}>
      <div className={styles.row}>
        <span className={layout.label}>Ad sets</span>
        <div role="group" aria-label="Ad sets" className={layout.seg}>
          {CHOICES.map((c) => (
            <button
              key={c.value}
              type="button"
              aria-label={c.name}
              aria-pressed={props.value === c.value}
              onClick={() => props.onChange(c.value)}
            >
              {c.text}
            </button>
          ))}
        </div>
      </div>
      <p className={styles.hint}>
        Per subject makes one direction for each subject, each with its own first ad.
      </p>
    </div>
  )
}
