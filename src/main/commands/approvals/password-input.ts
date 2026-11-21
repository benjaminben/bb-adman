// The password of approvals.createLink and approvals.setPassword (spec/approvals.md
// "approvals.createLink" step 1, security class). The input lets any text through as the
// password so the command itself can refuse a bad one with the rule's own sentence; the shared
// schema would put that sentence only in details.issues. The other fields are checked exactly
// as approvalsCampaignInput checks them.
import { z } from 'zod'
import { Password } from '@/shared/approvals/contract'
import { APPROVALS_PASSWORD_MESSAGE } from '@/shared/approvals/messages'
import { approvalsCampaignInput } from '@/shared/schemas/commands/approvals'
import { AppError } from '@/shared/schemas/result'
import { makePassword } from '@/main/approvals/make-password'

export const linkPasswordInput = approvalsCampaignInput
  .extend({ password: z.string().optional() })
  .strict()

// The chosen password when it passes the rule, else one made by makePassword. The refusal
// holds no part of the text.
export function choosePassword(given: string | undefined): string {
  if (given === undefined) return makePassword()
  if (!Password.safeParse(given).success) {
    throw new AppError('INVALID_INPUT', APPROVALS_PASSWORD_MESSAGE)
  }
  return given
}
