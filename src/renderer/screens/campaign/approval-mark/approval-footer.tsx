// The grid's tileFooter for the campaign page (AP-12): each tile's approval marks, from the
// approvals store's approvals.forCampaign reply. No footer before the first read.
import type { ReactNode } from 'react'
import type { ApprovalsForCampaign } from '@/shared/schemas/queries/approvals'
import type { VariantSummary } from '@/shared/schemas/queries/campaign'
import { ApprovalMark } from './approval-mark'

export function approvalFooter(
  data: ApprovalsForCampaign | null,
): ((variant: VariantSummary) => ReactNode) | undefined {
  if (data === null) return undefined
  const linkState = data.link?.state ?? null
  return (variant) => (
    <ApprovalMark
      title={variant.title}
      entry={data.variants.find((row) => row.variantId === variant.id)}
      linkState={linkState}
    />
  )
}
