// SPEC 6.10.12: the address is never printed, in an error either. Each case body runs inside
// `guarded`; whatever it throws is replaced by a new error holding only the safe text, with no
// cause and no fields, so Vitest has nothing else to print.
import { ProviderFailure } from '../../src/main/providers/types'
import { safeLine } from './print'

function textOf(error: unknown): string {
  if (error instanceof ProviderFailure) {
    const { kind, reason, detail } = error.error
    return `ProviderFailure kind: ${kind}, reason: ${reason ?? 'none'}, detail: ${detail}`
  }
  return error instanceof Error ? error.message : 'A value that is not an error was thrown'
}

// A new error with the safe text only. The caught error is left out on purpose: as a cause,
// Vitest would print it, address and all.
function safeError(error: unknown, origin: string): Error {
  return new Error(safeLine(textOf(error), origin))
}

export async function guarded<T>(origin: string, body: () => Promise<T>): Promise<T> {
  try {
    return await body()
  } catch (error) {
    throw safeError(error, origin)
  }
}
