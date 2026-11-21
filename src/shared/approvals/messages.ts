// The approvals feature's refusal reasons and sentences (spec/approvals.md "Commands", "The
// service client", "Queries and the event"). The one copy: commands, queries and screens
// import them from here. No sentence repeats a value the user typed or the service sent.
import { AppError } from '@/shared/schemas/result'

// details.reason of a RULE_VIOLATION, one sentence each.
export const APPROVALS_REASONS = [
  'approvals_not_set_up',
  'approvals_needs_bucket',
  'approval_link_exists',
  'approval_link_missing',
  'approval_link_gone',
  'too_many_variants',
] as const
export type ApprovalsReason = (typeof APPROVALS_REASONS)[number]

export const APPROVALS_REASON_MESSAGES: Record<ApprovalsReason, string> = {
  approvals_not_set_up: 'Add the approvals service address and key in Settings first.',
  approvals_needs_bucket:
    'Approval links need an Amazon S3 bucket for the pictures. Set one up in Settings, under Cloud storage.',
  approval_link_exists: 'This campaign already has a link.',
  approval_link_missing: 'This campaign has no link yet.',
  approval_link_gone:
    'This link no longer exists on the approvals service, so it is shown as turned off. Make a new link to share again.',
  too_many_variants: 'A gallery can show at most 500 variants.',
}

// The RULE_VIOLATION for a reason, with its sentence. Every approvals stub throws
// approvalsRefusal('approvals_not_set_up') until its slice replaces it.
export function approvalsRefusal(reason: ApprovalsReason): AppError {
  return new AppError('RULE_VIOLATION', APPROVALS_REASON_MESSAGES[reason], { reason })
}

// RULE_VIOLATION reason render_failed, with details.variantId (approvals.publish step 5).
export function renderFailedMessage(title: string): string {
  return `A picture of ${title} could not be drawn, so the gallery was not changed.`
}

// INVALID_INPUT sentences.
export const APPROVALS_ADDRESS_MESSAGE =
  'Enter an address that starts with https:// and has a host name, with nothing after it.'
export const APPROVALS_PASSWORD_MESSAGE =
  'A password needs 12 to 128 characters, with no line breaks.'

// AGENT_DENIED for both approvals queries.
export const APPROVALS_QUERY_DENIED =
  'Agents cannot read approvals in this version. Ask the user to do it in the app.'

// PROVIDER_ERROR details.kind of a failed request to the service, and its sentence.
// 'version' is health with another contract number; it is sent as kind 'other'.
export const APPROVALS_FAILURE_KINDS = [
  'bad_key',
  'not_set_up',
  'offline',
  'timeout',
  'other',
] as const
export type ApprovalsFailureKind = (typeof APPROVALS_FAILURE_KINDS)[number]

export const APPROVALS_FAILURE_MESSAGES: Record<ApprovalsFailureKind | 'version', string> = {
  bad_key: 'The approvals service did not accept the key. Check the key in Settings.',
  not_set_up: 'The approvals service has no key of its own yet. Finish its setup steps first.',
  offline: 'The approvals service could not be reached. Check the address and your connection.',
  timeout: 'The approvals service took too long to answer. Try again.',
  version: 'The approvals service is a different version from this app.',
  other: 'The approvals service gave an answer the app does not understand.',
}
