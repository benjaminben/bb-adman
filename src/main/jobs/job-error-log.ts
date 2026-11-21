// SPEC 9.1 [1.38] (security class): context.error for the log line of a job that stopped on an
// unforeseen error. Such an error can come from inside an adapter or a library, so it is not
// copied as the bus does:
//   name     the error's name, or the type of a thrown value that is not an Error
//   stack    the call-frame lines only. [1.40] The header, which holds the whole message and
//            may have lines that look like frames, is cut off first: the first line for an
//            empty message, else everything up to the end of the message. When the message
//            is not found there, the stack is null if the message is not logged, else the
//            frame lines of the whole stack are kept
//   message  with each of the provider's secrets removed; null when noMessage is set (a
//            provider whose serverText is true, or one not in the registry)
import { redactSecret } from '../providers/redact'

export type JobErrorContext = { name: string; message: string | null; stack: string | null }

function redacted(text: string, secrets: string[]): string {
  const longestFirst = [...secrets].sort((a, b) => b.length - a.length)
  return longestFirst.reduce((safe, secret) => redactSecret(safe, secret), text)
}

// What follows the header, or null when the message is not where the engine writes it.
function afterHeader(stack: string, message: string): string | null {
  const firstBreak = stack.indexOf('\n')
  if (message === '') return firstBreak === -1 ? '' : stack.slice(firstBreak + 1)
  const at = stack.indexOf(message)
  if (at === -1 || (firstBreak !== -1 && at >= firstBreak)) return null
  return stack.slice(at + message.length)
}

function framesOf(e: Error, secrets: string[], noMessage: boolean): string | null {
  if (typeof e.stack !== 'string') return null
  const rest = afterHeader(e.stack, e.message)
  if (rest === null && noMessage) return null
  const frames = (rest ?? e.stack).split('\n').filter((line) => line.trimStart().startsWith('at '))
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
    stack: isError ? framesOf(e, secrets, noMessage) : null,
  }
}
