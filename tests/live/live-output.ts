// SPEC 13, 14 H11 (F-04), [1.18] K5: a live test prints no key, in a failure too. Everything
// a live test prints, and every error it lets Vitest print, passes through `safeText` for every
// set value of LIVE_REDACTED_NAMES. A skip line names only the variables that are missing.
import { redactSecret } from '@/main/providers/redact'
import { REFUSED_PATH } from '@/main/providers/storage-paths'
import { ProviderFailure } from '@/main/providers/types'
import { LIVE_REDACTED_NAMES } from './env-file'

type Env = Record<string, string | undefined>

// The set values of the redacted live variables.
export function liveValues(env: Env = process.env): string[] {
  return LIVE_REDACTED_NAMES.flatMap((name) => {
    const value = env[name] ?? ''
    return value === '' ? [] : [value]
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

// Runs one live call. A failure prints its safe lines, then throws a short error in its place:
// the error kind only, as the printed lines already hold the detail ([1.18] K6).
export async function safely<T>(label: string, call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (failure) {
    const values = liveValues()
    livePrint(safeFailure(label, failure, values).lines, values)
    throw shortFailure(label, failure, values)
  }
}

// A new error with no cause and no fields: the label and, for a ProviderFailure, its kind.
function shortFailure(label: string, failure: unknown, values: string[]): Error {
  if (!(failure instanceof ProviderFailure)) return new Error(`${label} error`)
  return new Error(`${label} error ${safeText(failure.error.kind, values)}`)
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
    // [1.17] H21: the refused-path error is a fixed text with no path or live value; it is
    // let through as that text so a case can expect it exactly.
    if (isRefusedPath(failure)) throw refusedPath()
    throw safeFailure(label, failure, values).error
  }
}

function isRefusedPath(failure: unknown): boolean {
  return (
    failure instanceof Error &&
    !(failure instanceof ProviderFailure) &&
    failure.message === REFUSED_PATH
  )
}

// A new error with only the fixed text: no cause, no fields.
function refusedPath(): Error {
  return new Error(REFUSED_PATH)
}
