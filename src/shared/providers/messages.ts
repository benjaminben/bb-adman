// SPEC 6 "Plain messages" [REQ: FR-069]: one sentence per error kind, naming the provider.
// The one copy of the table in the code. The raw provider text never reaches the window.
// SPEC 14 1.41 TP-0: kept in src/shared so the window can show a failed job's sentence.
// Sentences only: nothing here may read keys, addresses or main-process modules.
import type { ProviderErrorKind } from '../schemas/queries/app'

const MESSAGES: Record<ProviderErrorKind, (p: string) => string> = {
  bad_key: (p) => `${p} did not accept your key. Check it in Settings and try again.`,
  quota: (p) =>
    `Your ${p} account has reached its limit. Check your plan with ${p}, then try again.`,
  refused: (p) =>
    `${p} declined this request because of its content rules. Change the prompt or the images and try again.`,
  timeout: (p) => `${p} took too long to answer. Try again.`,
  offline: (p) => `The app could not reach ${p}. Check your internet connection and try again.`,
  other: (p) => `${p} could not finish this request. Try again.`,
}

export function plainMessage(kind: ProviderErrorKind, providerLabel: string): string {
  return MESSAGES[kind](providerLabel)
}
