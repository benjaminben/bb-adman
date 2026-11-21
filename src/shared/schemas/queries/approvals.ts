// The approvals queries (spec/approvals.md "Queries and the event"). User only: an agent gets
// AGENT_DENIED. Approvals data is never added to any other query or MCP reply.
import { approvalsCampaignInput } from '@/shared/schemas/commands/approvals'

export const approvalsForCampaignInput = approvalsCampaignInput
export const approvalsGetPasswordInput = approvalsCampaignInput

// no_service: address or key missing; no_bucket: S3 settings or keys missing.
export type ApprovalsReady = 'ready' | 'no_service' | 'no_bucket'

export type ApprovalsSignoff = {
  id: string
  email: string
  signedAt: string
  version: number
  // The version equals the variant's publishedRev.
  current: boolean
}

export type ApprovalsLink = {
  state: 'live' | 'ended'
  // `{baseUrl}/l/{slug}`; null when no address is set.
  address: string | null
  createdAt: string
  publishedAt: string | null
  checkedAt: string | null
  endedAt: string | null
  passwordKept: boolean
}

export type ApprovalsVariant = {
  variantId: string
  currentRev: number
  // null: not in the gallery.
  publishedRev: number | null
  signoffs: ApprovalsSignoff[]
}

export type ApprovalsForCampaign = {
  ready: ApprovalsReady
  link: ApprovalsLink | null
  // Every variant of the campaign, in campaign.get order.
  variants: ApprovalsVariant[]
}

export type ApprovalsPassword = { password: string | null }
