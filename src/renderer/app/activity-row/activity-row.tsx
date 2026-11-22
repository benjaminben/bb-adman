// One job in the activity panel (spec/screens-ai.md, "The activity panel", Row) [REQ: FR-152,
// FR-217, FR-218; D-036]. SH-4 (spec/phases/design-wave-screens-a.md, "SH-4 — Activity panel"):
// an ObjectRow with the kind icon, what ran and on which provider, where and when (the robot for
// an agent's job), the status mark and one action: Cancel (ui/cancel-shown.ts) or Retry
// (background jobs only, row-retry.tsx). A row with a place to go is one button, "Go to
// {where}" (to the place ui/show-result.ts finds, R2E-6). A failed row keeps its sentence
// (ui/run-failure/) under it, visible; the paid two-step line of a Retry draws there too.
import { useState } from 'react'
import { EMPTY, useApi, useApp } from '@/renderer/app/app-context'
import type { ActivityEntry } from '@/renderer/stores/activity-store'
import { cancelShown } from '@/renderer/ui/cancel-shown'
import { goTarget, type GoTarget } from '@/renderer/ui/go-there'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { ObjectRow } from '@/renderer/ui/object-row'
import { resultTarget } from '@/renderer/ui/show-result'
import { RunFailure } from '@/renderer/ui/run-failure'
import type { JobRow } from '@/shared/schemas/rows/job'
import { RowMarks } from './row-marks'
import { RowRetry, retryShown } from './row-retry'
import { KIND_ICON, timeText, whatText, whereText } from './row-text'
import styles from './activity-row.module.css'

// A row with no place to go keeps the row's look but offers no button.
const NOT_A_BUTTON = { disabled: true, tabIndex: -1, 'aria-hidden': true } as const

function RowMeta(props: { job: JobRow; where: string }) {
  return (
    <>
      {props.job.startedBy === 'agent' && (
        <span className={styles.agent} title="Started by an agent">
          <Icon name="bot" size="small" />
          <span className={styles.hidden}>Started by an agent</span>
        </span>
      )}
      <span>{props.where}</span> · <span>{timeText(props.job.createdAt)}</span>
    </>
  )
}

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
  const [lineSlot, setLineSlot] = useState<HTMLDivElement | null>(null)
  const provider = providers.find((p) => p.id === job.provider)
  const label = provider?.label ?? job.provider
  const where = whereText(job, place)
  const target = goTarget(job, place)
  const go = () => void resultTarget(api, projectId, job, place).then((t) => t && props.onGo(t))

  const action = cancelShown(job, provider) ? (
    <button
      type="button"
      className={layout.iconButton}
      aria-label="Cancel"
      title="Cancel"
      onClick={() => void command('job.cancel', { projectId, jobId: job.id })}
    >
      <Icon name="x" />
    </button>
  ) : retryShown(job) ? (
    <RowRetry
      job={job}
      projectId={projectId}
      provider={provider}
      providerLabel={label ?? 'The provider'}
      lineSlot={lineSlot}
    />
  ) : undefined

  return (
    <li className={styles.row}>
      <ObjectRow
        name={whatText(job, label)}
        label={`Go to ${where}`}
        thumb={<Icon name={KIND_ICON[job.kind]} />}
        meta={<RowMeta job={job} where={where} />}
        marks={<RowMarks job={job} />}
        stateActions={action}
        onSelect={target ? go : undefined}
        mainProps={target ? undefined : NOT_A_BUTTON}
      />
      {job.status === 'failed' && (
        <div className={styles.below}>
          <RunFailure
            row={job}
            projectId={projectId}
            provider={provider}
            providerLabel={label ?? 'The provider'}
          />
        </div>
      )}
      <div ref={setLineSlot} className={styles.below} />
    </li>
  )
}
