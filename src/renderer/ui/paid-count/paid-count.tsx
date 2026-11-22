// The campaign's paid count (spec/screens-ai.md, "The paid count"; FR-230): shown in the run
// dialog and on the campaign page. A count of calls, not money; it shows numbers the app keeps
// and starts nothing. DLG-4a (OI-DW-7): a short info mark with the coin, "Paid so far: …" in
// real plurals, and today's full sentence as its tip. Nothing while the query has not answered
// or was refused.
import type { PaidCount as Counts } from '@/shared/schemas/queries/paid-count'
import { plural } from '@/renderer/ui/plural'
import { StatusMark } from '@/renderer/ui/status-mark'
import { usePaidCount } from './use-paid-count'
import styles from './paid-count.module.css'

export function paidCountLine(counts: Counts): string {
  const line = `Paid generations for this campaign so far: ${counts.pictures} pictures, ${counts.videos} videos.`
  return counts.text > 0 ? `${line} Text requests: ${counts.text}.` : line
}

export function paidCountLabel(counts: Counts): string {
  const parts = [plural(counts.pictures, 'picture'), plural(counts.videos, 'video')]
  if (counts.text > 0) parts.push(plural(counts.text, 'text request'))
  return `Paid so far: ${parts.join(', ')}`
}

export function PaidCount(props: { projectId: string; campaignId: string }) {
  const counts = usePaidCount(props.projectId, props.campaignId)
  if (counts === null) return null
  return (
    <p className={styles.line}>
      <StatusMark
        tone="info"
        icon="coin"
        label={paidCountLabel(counts)}
        tip={paidCountLine(counts)}
      />
    </p>
  )
}
