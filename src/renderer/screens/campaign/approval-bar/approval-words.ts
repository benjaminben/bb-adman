// CAMP-3 (spec/phases/design-wave-screens-b.md, "CAMP-3"): the words of the approvals button.
// Counts and times only: the link's address, its password, the service and reviewers' emails
// never reach a name, a tip or a mark. {a}: variants in the gallery with at least one sign-off
// (all are of the current rev, R-10); {b}: those in the gallery. Pure.
import type { ApprovalsForCampaign } from '@/shared/schemas/queries/approvals'
import type { StatusTone } from '@/renderer/ui/status-mark'
import { timeText } from '@/renderer/ui/signoff-list'

export type ApprovalLook = {
  name: string
  title?: string
  mark?: { tone: StatusTone; label: string; tip: string }
}

type State = { data: ApprovalsForCampaign | null; failure: string | null; notice: string | null }

export function approvalLook(state: State): ApprovalLook {
  const link = state.data?.link ?? null
  if (state.data === null || link === null) return { name: 'Approval link…' }
  if (link.state === 'ended') {
    const title = state.notice ?? 'Link turned off'
    return { name: 'Approval link… off', title, mark: { tone: 'none', label: 'Off', tip: 'Off' } }
  }
  const shown = state.data.variants.filter((v) => v.publishedRev !== null)
  const a = shown.filter((v) => v.signoffs.length > 0).length
  const b = shown.length
  const noun = b === 1 ? 'variant' : 'variants'
  const signed = `Signed off: ${a} of ${b} ${noun}`
  // A failure takes the place of "Checked {time}", as before; it is words beside the button.
  const checked = state.failure === null && link.checkedAt ? timeText(link.checkedAt) : null
  const title = checked === null ? signed : `${signed}. Checked ${checked}`
  const tone: StatusTone = b > 0 && a === b ? 'ok' : 'none'
  return { name: `Approval link… ${a}/${b}`, title, mark: { tone, label: `${a}/${b}`, tip: title } }
}
