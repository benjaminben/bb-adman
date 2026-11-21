// SPEC 9.1 [1.38] (security class): context.error for the log line of a job that stopped on an
// unforeseen error. Such an error can come from inside an adapter or a library, so it is not
// copied as the bus does:
//   name     the error's name, or the type of a thrown value that is not an Error
//   stack    the call-frame lines only; the first line, which repeats the message, is left out
//   message  with each of the provider's secrets removed; null when noMessage is set (a
//            provider whose serverText is true, or one not in the registry)
import { redactSecret } from '../providers/redact'

export type JobErrorContext = { name: string; message: string | null; stack: string | null }

function redacted(text: string, secrets: string[]): string {
  const longestFirst = [...secrets].sort((a, b) => b.length - a.length)
  return longestFirst.reduce((safe, secret) => redactSecret(safe, secret), text)
}

function framesOf(stack: string | undefined, secrets: string[]): string | null {
  if (stack === undefined) return null
  const frames = stack.split('\n').filter((line) => line.trimStart().startsWith('at '))
  return redacted(frames.join('\n'), secrets)
}

export function jobErrorContext(
  e: unknown,
  secrets: string[],
  noMessage: boolean,
): JobErrorContext {
  const isError = e instanceof Error
  const text = isError ? e.message : String(e)
  return {
    name: isError ? e.name : typeof e,
    message: noMessage ? null : redacted(text, secrets),
    stack: isError ? framesOf(e.stack, secrets) : null,
  }
}
