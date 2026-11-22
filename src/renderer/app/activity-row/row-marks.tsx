// SH-4 (spec/phases/design-wave-screens-a.md, "SH-4 — Activity panel"): a row's status as one
// StatusMark, and the "New result" dot for a result not yet looked at. A running video's words
// ("Working, 3 min", "Waiting (place 2)") and a running picture run's stage are the mark's
// tip, which the mark also keeps as hidden text, so the words stay in the row.
import { useNow, videoRunningText, workingDetail } from '@/renderer/ui/run-status'
import { StatusMark, type StatusMarkProps } from '@/renderer/ui/status-mark'
import type { JobRow } from '@/shared/schemas/rows/job'

type Look = Pick<StatusMarkProps, 'tone' | 'icon' | 'label'>

const STATUS_LOOK: Record<JobRow['status'], Look> = {
  queued: { tone: 'none', icon: 'clock', label: 'Waiting' },
  running: { tone: 'running', label: 'Working' },
  succeeded: { tone: 'ok', icon: 'check', label: 'Done' },
  failed: { tone: 'danger', icon: 'xCircle', label: 'Failed' },
  cancelled: { tone: 'none', icon: 'x', label: 'Cancelled' },
}

export function RowMarks(props: { job: JobRow }) {
  const { job } = props
  const video = job.kind === 'video_generation'
  const now = useNow(video && job.status === 'running')
  const look = STATUS_LOOK[job.status]
  const running = job.status === 'running'
  const words = running ? (video ? videoRunningText(job, now) : workingDetail(job)) : ''
  const unseen = job.status === 'succeeded' && job.seenAt === null
  return (
    <>
      <StatusMark {...look} tip={words || (look.label ?? '')} />
      {unseen && <StatusMark tone="accent" tip="New result" />}
    </>
  )
}
