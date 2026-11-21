// One checked variant in the check panel (spec/phases/phase-06.md, design addition 8): the
// heading "{title} · {size} · {language}", "Changed since the last check." when stale, and one
// row per check "{check name}: Passed | Warning | Skipped" with the findings under a warning or
// skip. Findings are drawn as React text only: rule words and layer names are typed by anyone.
import type { CheckResult } from '@/shared/schemas/checks'
import type { VariantCheckState } from '@/shared/schemas/queries/check'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { Icon, type IconName } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { blockHeading, checkName, statusWord } from './check-words'
import styles from './check-panel.module.css'

const ICONS: Record<CheckResult['status'], IconName> = {
  pass: 'check',
  warn: 'alert',
  skipped: 'minus',
}

const KINDS: Record<CheckResult['status'], string | undefined> = {
  pass: layout.ok,
  warn: layout.warn,
  skipped: layout.neutral,
}

function CheckRow(props: { result: CheckResult }) {
  const r = props.result
  const shown = r.status !== 'pass' && r.findings.length > 0
  return (
    <li className={styles.check}>
      <span className={`${layout.badge} ${KINDS[r.status]}`}>
        <Icon name={ICONS[r.status]} size="small" />
        {`${checkName(r.checkId)}: ${statusWord(r.status)}`}
      </span>
      {shown && (
        <ul className={styles.findings}>
          {r.findings.map((f, i) => (
            <li
              key={`${i}-${f.layerId ?? ''}`}
              className={r.status === 'skipped' ? layout.muted : ''}
            >
              {f.message}
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}

export function CheckBlock(props: { variant: VariantSummary; state: VariantCheckState }) {
  const headingId = `check-block-${props.variant.id}`
  return (
    <article className={styles.block} aria-labelledby={headingId}>
      <h3 id={headingId} className={styles.heading}>
        {blockHeading(props.variant)}
      </h3>
      {props.state.stale && (
        <p className={`${layout.notice} ${layout.info}`}>
          <Icon name="clock" size="small" />
          Changed since the last check.
        </p>
      )}
      <ul className={`${layout.list} ${styles.checks}`} aria-label="Checks run">
        {props.state.results.map((result) => (
          <CheckRow key={result.checkId} result={result} />
        ))}
      </ul>
    </article>
  )
}
