// The right side of a language's Section header (CAMP-5): the bar of approved rows with
// "{a}/{b}" (title "{a} of {b} approved"), a spinner and "Stop" per running job, "Approve all"
// (named "Approve all {language}"; disabled with the title "Nothing proposed" when no row is
// proposed) and "Translate again…" (named "Translate {language} again…"; it opens the run dialog).
import layout from '@/renderer/ui/layout.module.css'
import type { TranslationJobState, TranslationRow } from '@/shared/schemas/queries/translation'
import { RunningMark, isRunning } from './job-line'
import { TranslateAgain } from './translate-again'
import { approvedCount, languageName, requestCount } from './translation-words'
import styles from './translation-panel.module.css'

export type GroupHeadProps = {
  projectId: string
  campaignId: string
  language: string
  rows: TranslationRow[]
  jobs: TranslationJobState[]
  busy: boolean
  proposed: number
  onApproveAll: () => void
}

function Progress(props: { rows: TranslationRow[] }) {
  const count = approvedCount(props.rows)
  const share = props.rows.length === 0 ? 0 : (count.done / props.rows.length) * 100
  return (
    <span className={styles.progress} title={count.tip}>
      <span className={`${layout.progress} ${styles.bar}`} aria-hidden="true">
        <span style={{ width: `${share}%` }} />
      </span>
      <span aria-hidden="true">{count.text}</span>
      <span className={styles.hidden}>{count.tip}</span>
    </span>
  )
}

export function GroupHead(props: GroupHeadProps) {
  const name = languageName(props.language)
  const nothing = props.proposed === 0
  const variantIds = [...new Set(props.rows.map((row) => row.variantId))]
  return (
    <span className={styles.groupHead}>
      <Progress rows={props.rows} />
      {props.jobs.filter(isRunning).map((job) => (
        <RunningMark
          key={job.jobId}
          projectId={props.projectId}
          campaignId={props.campaignId}
          job={job}
        />
      ))}
      <button
        type="button"
        className={`${layout.quiet} ${layout.small}`}
        aria-label={`Approve all ${name}`}
        title={nothing ? 'Nothing proposed' : undefined}
        disabled={props.busy || nothing}
        onClick={props.onApproveAll}
      >
        Approve all
      </button>
      <TranslateAgain
        projectId={props.projectId}
        campaignId={props.campaignId}
        language={props.language}
        variantIds={variantIds}
        requests={requestCount(props.rows)}
      />
    </span>
  )
}
