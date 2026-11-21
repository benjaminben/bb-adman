// SPEC 13, 14 H11 (F-04), [1.15] H16: a live test prints no key and no bucket name, in a
// failure too. Everything a live test prints, and every error it lets Vitest print, passes
// through `safeText` for every set value of LIVE_REDACTED_NAMES (the prefix only when it is
// long enough). A skip line names only the variables that are missing.
import { redactSecret } from '../../src/main/providers/redact'
import { ProviderFailure } from '../../src/main/providers/types'
import { LIVE_REDACTED_MIN_LENGTH, LIVE_REDACTED_NAMES } from './env-file'

type Env = Record<string, string | undefined>

// The set values of the redacted live variables, each at least its minimum length.
export function liveValues(env: Env = process.env): string[] {
  return LIVE_REDACTED_NAMES.flatMap((name) => {
    const value = env[name] ?? ''
    return value.length >= (LIVE_REDACTED_MIN_LENGTH[name] ?? 1) ? [value] : []
  })
}

// Longest first, so a value held inside a longer one cannot leave part of the longer behind.
export function safeText(text: string, values: string[] = liveValues()): string {
  const longestFirst = [...values].sort((a, b) => b.length - a.length)
  return longestFirst.reduce((safe, value) => redactSecret(safe, value), text)
}

export function missingNames(names: string[], env: Env = process.env): string[] {
  return names.filter((name) => (env[name] ?? '') === '')
}

export function livePrint(lines: string[], values: string[] = liveValues()): void {
  process.stdout.write(lines.map((line) => `${safeText(line, values)}\n`).join(''))
}

// The lines to print for a failure, and a new error to throw in its place: no cause, no
// fields, nothing but the safe text, so Vitest has no live value to print.
export function safeFailure(
  label: string,
  failure: unknown,
  values: string[] = liveValues(),
): { lines: string[]; error: Error } {
  if (failure instanceof ProviderFailure) {
    const kind = safeText(failure.error.kind, values)
    const detail = safeText(failure.error.detail, values)
    const lines = [`${label} error kind: ${kind}`, `${label} error detail: ${detail}`]
    return { lines, error: new Error(`${label} error ${kind}: ${detail}`) }
  }
  const message = safeText(failure instanceof Error ? failure.message : String(failure), values)
  return { lines: [`${label} error: ${message}`], error: new Error(`${label} error: ${message}`) }
}

// Runs one live call. A failure prints its safe lines and throws the safe error instead.
export async function safely<T>(label: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (failure) {
    const { lines, error } = safeFailure(label, failure)
    livePrint(lines)
    throw error
  }
}

// [1.16] H20: runs one live call and prints nothing. A failure throws the safe error, so a
// case that expects it prints nothing, and Vitest shows it only when a case did not expect it.
export async function quietly<T>(
  label: string,
  call: () => Promise<T>,
  values: string[] = liveValues(),
): Promise<T> {
  try {
    return await call()
  } catch (failure) {
    throw safeFailure(label, failure, values).error
  }
}
