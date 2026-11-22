// spec/phases/round-2-approvals.md "The app (item 19, R-10)": a tile's approval marks, from its
// approvals.forCampaign row and the link's state. Pure. The first that applies: "Not in the
// gallery" (live link, not published), "Signed off by {n}", "Changed since published", none.
// Only sign-offs of the current rev count; the query gives no other.
import type { ApprovalsLink, ApprovalsVariant } from '@/shared/schemas/queries/approvals'

export type ApprovalLinkState = ApprovalsLink['state'] | null

export function approvalMarks(
  entry: ApprovalsVariant | undefined,
  linkState: ApprovalLinkState,
): string[] {
  if (linkState === null || entry === undefined) return []
  if (entry.publishedRev === null && linkState === 'live') return ['Not in the gallery']
  const signed = entry.signoffs.filter((s) => s.version === entry.currentRev).length
  if (signed > 0) return [`Signed off by ${signed}`]
  if (entry.publishedRev !== null && entry.currentRev !== entry.publishedRev) {
    return ['Changed since published']
  }
  return []
}
