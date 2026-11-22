// The export dialog's warnings step (spec/phases/phase-08.md "Export run", warnings gate;
// DLG-6a): the warnings export.run refused with, each warned ad as a row with its thumbnail,
// "{size} · {language}", an alert mark and the warning's words visible, drawn as text; and the
// optional reason, at most 500 characters. Its buttons are the foot.
import layout from '@/renderer/ui/layout.module.css'
import { ObjectRow } from '@/renderer/ui/object-row'
import { StatusMark } from '@/renderer/ui/status-mark'
import type { ExportWarning } from '@/shared/schemas/commands/export'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { AdThumb, adLine, adName } from './ad-ticks'
import styles from './export-dialog.module.css'

export const MAX_REASON = 500
const HEADING = 'These ads have warnings'
const COVER = { tabIndex: -1, 'aria-hidden': true } as const

export type ExportWarningsProps = {
  projectId: string
  warnings: ExportWarning[]
  ads: VariantSummary[]
  reason: string
  disabled: boolean
  onReason: (reason: string) => void
}

export function ExportWarnings(props: ExportWarningsProps) {
  const byId = new Map(props.ads.map((ad) => [ad.id, ad]))

  return (
    <>
      <p className={styles.heading}>{HEADING}</p>
      <ul aria-label={HEADING} className={`${layout.list} ${styles.ads}`}>
        {props.warnings.map((w, i) => {
          const ad = byId.get(w.variantId)
          return (
            <li key={i}>
              <ObjectRow
                name={ad ? adName(ad) : 'Ad'}
                label={ad ? adLine(ad) : 'Ad'}
                title={ad ? adLine(ad) : undefined}
                thumb={ad && <AdThumb projectId={props.projectId} ad={ad} />}
                meta={w.message}
                marks={<StatusMark tone="warn" icon="alert" tip="Warning" />}
                mainProps={COVER}
              />
            </li>
          )
        })}
      </ul>
      <input
        type="text"
        className={styles.reason}
        aria-label="Reason for exporting anyway (optional)"
        placeholder="Why export anyway? (optional)"
        maxLength={MAX_REASON}
        value={props.reason}
        disabled={props.disabled}
        onChange={(e) => props.onReason(e.target.value)}
      />
    </>
  )
}
