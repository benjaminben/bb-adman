// Z-1b: a live link's last refresh failure as words on the page, drawn by the campaign head on
// its own line under the head row, so a long sentence never squeezes the campaign's name. A
// failure is never cut short or moved into a tip.
import { useStore } from 'zustand'
import type { ApprovalsStore } from '@/renderer/stores/approvals-store'
import styles from './approval-bar.module.css'

export function ApprovalFailure(props: { store: ApprovalsStore; className?: string }) {
  const live = useStore(props.store, (s) => s.data?.link?.state === 'live')
  const failure = useStore(props.store, (s) => s.failure)
  if (!live || failure === null) return null
  const extra = props.className === undefined ? '' : ` ${props.className}`
  return <p className={`${styles.failure}${extra}`}>{failure}</p>
}
