// The campaign's paid count (spec/screens-ai.md, "The paid count"; FR-230): shown in the run
// dialog and on the campaign overview. A count of calls, not money. Nothing while the query
// has not answered or was refused.
import type { PaidCount as Counts } from '@/shared/schemas/queries/paid-count'
import { usePaidCount } from './use-paid-count'
import styles from './paid-count.module.css'

export function paidCountLine(counts: Counts): string {
  const line = `Paid generations for this campaign so far: ${counts.pictures} pictures, ${counts.videos} videos.`
  return counts.text > 0 ? `${line} Text requests: ${counts.text}.` : line
}

export function PaidCount(props: { projectId: string; campaignId: string }) {
  const counts = usePaidCount(props.projectId, props.campaignId)
  if (counts === null) return null
  return <p className={styles.line}>{paidCountLine(counts)}</p>
}
