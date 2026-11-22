// Reading a Dropbox answer (spec/phases/phase-09.md "Dropbox hosts and calls"). Every body is read
// under a byte limit: 1 MiB for JSON. A break during the read is marked as a network error, like
// a break during the send. A body that is not JSON or does not fit its schema is refused with a
// fixed detail: the parse error's own words can quote the answer, which can hold a token.
import type { z } from 'zod'
import { readLimited } from '@/main/providers/read-limited'
import { ProviderFailure } from '@/main/providers/types'
import { answerFailure, type DropboxCall } from './failure'
import { DropboxNetworkError } from './pinned-fetch'

export const MAX_JSON_ANSWER_BYTES = 1024 * 1024
export const UNREADABLE = 'Dropbox sent an answer Adman cannot read'

export async function readAnswer(response: Response, limit: number): Promise<Uint8Array> {
  try {
    return new Uint8Array(await readLimited(response, limit))
  } catch (error) {
    if (error instanceof ProviderFailure) throw error
    throw new DropboxNetworkError(error)
  }
}

function parsed(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new ProviderFailure({ kind: 'other', detail: UNREADABLE })
  }
}

// The body of a success, checked against its schema; any other status is that status's failure.
export async function jsonAnswer<T>(
  response: Response,
  schema: z.ZodType<T>,
  secrets: string[],
  call: DropboxCall = 'api',
): Promise<T> {
  const bytes = await readAnswer(response, MAX_JSON_ANSWER_BYTES)
  if (!response.ok) throw answerFailure(response.status, bytes, secrets, call)
  const checked = schema.safeParse(parsed(bytes))
  if (!checked.success) throw new ProviderFailure({ kind: 'other', detail: UNREADABLE })
  return checked.data
}

// A success whose body the app does not use (still read under the limit), or the failure.
export async function emptyAnswer(response: Response, secrets: string[]): Promise<void> {
  const bytes = await readAnswer(response, MAX_JSON_ANSWER_BYTES)
  if (!response.ok) throw answerFailure(response.status, bytes, secrets)
}
