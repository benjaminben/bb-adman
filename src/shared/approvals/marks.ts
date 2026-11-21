// spec/approvals.md "Versions and marks": a tile's approval marks, from its approvals.forCampaign
// row and the link's state. Pure. A variant changed since publishing that holds only
// earlier-version sign-offs shows both "Changed since published" and "Earlier version signed off".
// With an ended link, "Not in the gallery" is not shown; the sign-off marks still are.
import type { ApprovalsLink, ApprovalsVariant } from '@/shared/schemas/queries/approvals'

export type ApprovalLinkState = ApprovalsLink['state'] | null

export function approvalMarks(
  entry: ApprovalsVariant | undefined,
  linkState: ApprovalLinkState,
): string[] {
  if (linkState === null || entry === undefined) return []
  if (entry.publishedRev === null && linkState === 'live') return ['Not in the gallery']
  const current = entry.signoffs.filter((s) => s.current).length
  const earlier = entry.signoffs.length > current
  const changed = entry.publishedRev !== null && entry.currentRev !== entry.publishedRev
  if (current > 0) {
    const signed = `Signed off by ${current}`
    return changed ? [signed, 'Changed since sign-off'] : [signed]
  }
  const marks = changed ? ['Changed since published'] : []
  return earlier ? [...marks, 'Earlier version signed off'] : marks
}
