// One job in the activity panel (spec/screens-ai.md, "The activity panel", Row) [REQ: FR-152,
// FR-217, FR-218; D-036]: what and where, the status as the run row words it, when it started,
// who started it and the "New" mark; then Go there (to the place ui/show-result.ts finds,
// R2E-6), Cancel (ui/cancel-shown.ts) and Retry (background jobs only). A failed row shows its
// sentence through ui/run-failure/.
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import { workingDetail } from '@/renderer/screens/campaign/run-row/run-row'
import { useNow, videoRunningText } from '@/renderer/screens/campaign/run-row/video-status'
import type { ActivityEntry } from '@/renderer/stores/activity-store'
import { cancelShown } from '@/renderer/ui/cancel-shown'
import { BusySpinner } from '@/renderer/ui/dialog-frame'
import { goTarget, type GoTarget } from '@/renderer/ui/go-there'
import { Icon } from '@/renderer/ui/icon'
import { resultTarget } from '@/renderer/ui/show-result'
import layout from '@/renderer/ui/layout.module.css'
import { RunFailure } from '@/renderer/ui/run-failure'
import { RowRetry, retryShown } from './row-retry'
import { startedText, whatText, whereText } from './row-text'
import styles from './activity-row.module.css'

const STATUS_TEXT = {
  queued: 'Waiting',
  running: 'Working',
  succeeded: 'Done',
  failed: 'Failed',
  cancelled: 'Cancelled',
} as const

// The status badge's kind and icon (spec/app-style.md, "Badge": icon plus word).
const STATUS_LOOK = {
  queued: ['neutral', 'clock'],
  running: ['accent', null],
  succeeded: ['ok', 'check'],
  failed: ['danger', 'alert'],
  cancelled: ['neutral', 'x'],
} as const

export function ActivityRow(props: {
  entry: ActivityEntry
  projectId: string
  onGo: (target: GoTarget) => void
}) {
  const { job, place } = props.entry
  const { projectId } = props
  const api = useApi()
  const command = useApp((s) => s.command)
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const provider = providers.find((p) => p.id === job.provider)
  const label = provider?.label ?? job.provider
  const video = job.kind === 'video_generation'
  const now = useNow(video && job.status === 'running')
  const status =
    video && job.status === 'running' ? videoRunningText(job, now) : STATUS_TEXT[job.status]
  const detail = job.status === 'running' && !video ? workingDetail(job) : ''
  const where = whereText(job, place)
  const target = goTarget(job, place)
  const unseen = job.status === 'succeeded' && job.seenAt === null
  const [kind, icon] = STATUS_LOOK[job.status]

  return (
    <li className={unseen ? `${styles.row} ${styles.fresh}` : styles.row}>
      <p className={styles.what}>{whatText(job, label)}</p>
      <p className={styles.muted}>{where}</p>
      <p className={styles.line}>
        <span className={`${layout.badge} ${layout[kind]}`}>
          {icon === null ? <BusySpinner /> : <Icon name={icon} size="small" />}
          {status}
        </span>
        {detail && <span className={styles.muted}>{detail}</span>}
        <span className={styles.muted}>{startedText(job.createdAt)}</span>
        {unseen && <span className={`${layout.badge} ${layout.accent} ${styles.new}`}>New</span>}
      </p>
      {job.startedBy === 'agent' && <p className={styles.muted}>Started by an agent</p>}
      {job.status === 'failed' && (
        <RunFailure
          row={job}
          projectId={projectId}
          provider={provider}
          providerLabel={label ?? 'The provider'}
        />
      )}
      <div className={styles.buttons}>
        {target && (
          <button
            type="button"
            className={layout.small}
            aria-label={`Go to ${where}`}
            onClick={() =>
              void resultTarget(api, projectId, job, place).then((t) => t && props.onGo(t))
            }
          >
            Go there
          </button>
        )}
        {cancelShown(job, provider) && (
          <button
            type="button"
            className={layout.small}
            onClick={() => void command('job.cancel', { projectId, jobId: job.id })}
          >
            Cancel
          </button>
        )}
        {retryShown(job) && (
          <RowRetry
            job={job}
            projectId={projectId}
            provider={provider}
            providerLabel={label ?? 'The provider'}
          />
        )}
      </div>
    </li>
  )
}
