// The Phase 9 refusal reasons and sentences: publishing and Dropbox (spec/phases/phase-09.md
// "Design additions"). The one copy: commands, queries, the job and the screens import them from
// here. No sentence holds a path, a token, an address or a value the user typed. The job's own
// reasons (dropbox_signed_out, export_not_built, export_failed, work_folder_unsafe) are
// PROVIDER_ERROR_REASONS, with their sentences in src/shared/providers/messages.ts.
import { AppError, type ErrorCode } from '@/shared/schemas/result'

// details.reason of each refusal, with its code and sentence. `{port}` is filled by the caller.
export const PUBLISH_REFUSALS = {
  not_built_yet: { code: 'RULE_VIOLATION', message: 'This part of Adman is not built yet.' },
  dropbox_not_signed_in: {
    code: 'RULE_VIOLATION',
    message: 'Sign in to Dropbox in Settings, then try again.',
  },
  dropbox_folder_refused: {
    code: 'INVALID_INPUT',
    message: 'That folder name cannot be used in Dropbox.',
  },
  sign_in_in_progress: {
    code: 'RULE_VIOLATION',
    message: 'A Dropbox sign-in is already waiting for the browser.',
  },
  sign_in_port_busy: {
    code: 'RULE_VIOLATION',
    message:
      "Adman could not wait for Dropbox's answer: another program is using port {port}. Close it and try again.",
  },
  sign_in_timed_out: {
    code: 'RULE_VIOLATION',
    message: 'The Dropbox sign-in took too long. Try again.',
  },
  sign_in_refused: { code: 'RULE_VIOLATION', message: 'The Dropbox sign-in was cancelled.' },
  sign_in_failed: {
    code: 'PROVIDER_ERROR',
    message: 'Dropbox did not finish the sign-in. Try again.',
  },
  campaign_id_unsafe: {
    code: 'RULE_VIOLATION',
    message: "This campaign's ID cannot be used as a folder name.",
  },
  publish_running: {
    code: 'RULE_VIOLATION',
    message: 'This campaign is being published. Wait until it ends.',
  },
  replace_not_confirmed: {
    code: 'RULE_VIOLATION',
    message: 'This campaign already has published files. Confirm that they will be replaced.',
  },
  publish_has_warnings: {
    code: 'RULE_VIOLATION',
    message: 'Some ads have warnings. Fix them or publish anyway.',
  },
  retry_not_offered: { code: 'RULE_VIOLATION', message: 'Publish again from the campaign.' },
} as const satisfies Record<string, { code: ErrorCode; message: string }>

export type PublishRefusalReason = keyof typeof PUBLISH_REFUSALS

// The refusal for a reason, with its code and sentence. publish_has_warnings also carries
// details.warnings, so its command builds that one itself.
export function publishRefusal(
  reason: Exclude<PublishRefusalReason, 'publish_has_warnings' | 'sign_in_port_busy'>,
): AppError {
  const { code, message } = PUBLISH_REFUSALS[reason]
  return new AppError(code, message, { reason })
}

// sign_in_port_busy names the port, a fixed number from the code, never a value from outside.
export function signInPortBusy(port: number): AppError {
  const { code, message } = PUBLISH_REFUSALS.sign_in_port_busy
  return new AppError(code, message.replace('{port}', String(port)), {
    reason: 'sign_in_port_busy',
  })
}

// AGENT_DENIED for publish.inspect: its answer holds full local paths (A-218).
export const PUBLISH_INSPECT_DENIED =
  'Agents cannot read publish details in this version. Ask the user to do it in the app.'

// publish.inspect's PROVIDER_ERROR, followed by the storage kind's own sentence.
export const PUBLISHED_FOLDER_UNREADABLE = 'Adman could not look at the published folder.'

// The sign-in's pages in the browser.
export const SIGN_IN_PAGES = {
  done: 'You can close this tab and go back to Adman.',
  wrongState: 'This sign-in is not the one Adman is waiting for.',
} as const
