// The export dialog's warnings step (spec/phases/phase-08.md "Export run", warnings gate): the
// warnings export.run refused with, one line each, "{title} · {size} · {language}: {message}",
// drawn as text; and the optional reason, at most 500 characters. Its buttons are the foot.
import { useId } from 'react'
import layout from '@/renderer/ui/layout.module.css'
import type { ExportWarning } from '@/shared/schemas/commands/export'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { adLine } from './ad-ticks'
import styles from './export-dialog.module.css'

export const MAX_REASON = 500
const HEADING = 'These ads have warnings'

export type ExportWarningsProps = {
  warnings: ExportWarning[]
  ads: VariantSummary[]
  reason: string
  disabled: boolean
  onReason: (reason: string) => void
}

export function ExportWarnings(props: ExportWarningsProps) {
  const id = useId()
  const byId = new Map(props.ads.map((ad) => [ad.id, ad]))
  const line = (w: ExportWarning) => {
    const ad = byId.get(w.variantId)
    return ad ? `${adLine(ad)}: ${w.message}` : w.message
  }

  return (
    <>
      <p className={styles.heading}>{HEADING}</p>
      <ul aria-label={HEADING} className={styles.warnings}>
        {props.warnings.map((w, i) => (
          <li key={i}>{line(w)}</li>
        ))}
      </ul>
      <div className={layout.field}>
        <label htmlFor={`${id}-reason`}>Reason for exporting anyway (optional)</label>
        <input
          id={`${id}-reason`}
          type="text"
          maxLength={MAX_REASON}
          value={props.reason}
          disabled={props.disabled}
          onChange={(e) => props.onReason(e.target.value)}
        />
      </div>
    </>
  )
}
