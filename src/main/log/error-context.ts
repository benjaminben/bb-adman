// The full text of an unforeseen error, for the log line only (SPEC 4.1, 9.1).
export type ErrorContext = { name: string; message: string; stack: string | null }

export function errorContext(e: unknown): ErrorContext {
  if (e instanceof Error) return { name: e.name, message: e.message, stack: e.stack ?? null }
  return { name: typeof e, message: String(e), stack: null }
}
