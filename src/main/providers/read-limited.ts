// [1.20] L1 (Section 6, F-01): an answer body read under a byte limit. Moved from the Gemini
// wrapper unchanged (P7-14) so the fal wrapper reads the same way.
import { ProviderFailure } from '@/main/providers/types'

// An answer over the limit is `other`, never `offline`: the network did not fail.
function tooLarge(): ProviderFailure {
  return new ProviderFailure({ kind: 'other', detail: 'Answer too large' })
}

// For an answer with no body stream to count.
function checkedWhole(body: ArrayBuffer, limit: number): ArrayBuffer {
  if (body.byteLength > limit) throw tooLarge()
  return body
}

// Refuses at once, reading nothing, when content-length is over the limit. Otherwise counts
// the bytes handed to the app and cancels the read once the count passes the limit.
export async function readLimited(response: Response, limit: number): Promise<ArrayBuffer> {
  if (Number(response.headers.get('content-length')) > limit) {
    await response.body?.cancel().catch(() => undefined)
    throw tooLarge()
  }
  if (!response.body) return checkedWhole(await response.arrayBuffer(), limit)
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let count = 0
  for (let part = await reader.read(); !part.done; part = await reader.read()) {
    count += part.value.byteLength
    if (count > limit) {
      await reader.cancel().catch(() => undefined)
      throw tooLarge()
    }
    chunks.push(part.value)
  }
  const whole = new Uint8Array(count)
  let at = 0
  for (const chunk of chunks) {
    whole.set(chunk, at)
    at += chunk.byteLength
  }
  return whole.buffer
}
