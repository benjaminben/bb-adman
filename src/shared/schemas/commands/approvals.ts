// The approvals command inputs and replies (spec/approvals.md "Commands"). Every input refuses
// unknown keys, and the IDs pass the contract's rules before any handler sees them, since they
// reach a service path and a storage folder.
import { z } from 'zod'
import { CampaignId, Password, ProjectId } from '@/shared/approvals/contract'
import { APPROVALS_PASSWORD_MESSAGE } from '@/shared/approvals/messages'
import { projectScoped } from './project-scoped'

// approvals.setService: the address as typed, or null to remove it.
export const approvalsSetServiceInput = z.object({ address: z.string().nullable() }).strict()
export type ApprovalsSetServiceReply = { baseUrl: string | null }

// approvals.check takes no input; it answers { ok: true } or fails.
export const approvalsCheckInput = z.object({}).strict()
export type ApprovalsCheckReply = { ok: true }

// approvals.publish, approvals.refresh and approvals.endLink.
export const approvalsCampaignInput = projectScoped
  .extend({ projectId: ProjectId, campaignId: CampaignId })
  .strict()
export type ApprovalsCampaignInput = z.infer<typeof approvalsCampaignInput>

// The contract's password rule, with its one sentence.
export const approvalsPassword = z
  .string()
  .refine((text) => Password.safeParse(text).success, APPROVALS_PASSWORD_MESSAGE)

// approvals.createLink and approvals.setPassword: no password means one is made.
export const approvalsCreateLinkInput = approvalsCampaignInput
  .extend({ password: approvalsPassword.optional() })
  .strict()
export const approvalsSetPasswordInput = approvalsCreateLinkInput
export type ApprovalsPasswordInput = z.infer<typeof approvalsCreateLinkInput>

export type ApprovalsCreateLinkReply = { slug: string }
export type ApprovalsSetPasswordReply = Record<string, never>
export type ApprovalsPublishReply = { variants: number; drawn: number; clips: number }
export type ApprovalsRefreshReply = { changed: boolean; gone: boolean }
