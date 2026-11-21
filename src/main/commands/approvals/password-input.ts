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
import type { PasswordStore } from '@/main/approvals/types'
import { INSECURE_MESSAGE } from '@/main/secrets/secret-store'

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

// AP-8 ruling: asked after the shared refusals and before the first request, so a link is never
// made or changed on the service with a password this computer cannot keep. The store's own
// refusal.
export function requireCanKeep(passwords: PasswordStore): void {
  if (!passwords.canKeep()) {
    throw new AppError('RULE_VIOLATION', INSECURE_MESSAGE, { reason: 'secure_storage_unavailable' })
  }
}
