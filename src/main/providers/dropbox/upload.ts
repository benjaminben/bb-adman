// Writing one file to Dropbox (spec/phases/phase-09.md "Dropbox hosts and calls"). Bytes up to
// 8 MiB go in one files/upload; anything larger, and every stream, goes through an upload
// session: start, append_v2 in 8 MiB parts at their offsets, finish. Every write replaces the
// one path asked for (mode overwrite, no rename) and does not notify the user (mute). Each part
// is held in memory while it is sent, so a request can be sent again after a 401.
import { z } from 'zod'
import type { DropboxCalls } from './dropbox-storage'

export const SINGLE_UPLOAD_MAX = 8 * 1024 * 1024
const PART = SINGLE_UPLOAD_MAX

const Session = z.object({ session_id: z.string().min(1).max(1000) })

const commitOf = (path: string) => ({
  path,
  mode: 'overwrite',
  autorename: false,
  mute: true,
  strict_conflict: false,
})

function joined(chunks: Uint8Array[], size: number): Uint8Array {
  const whole = new Uint8Array(size)
  let at = 0
  for (const chunk of chunks) {
    whole.set(chunk, at)
    at += chunk.byteLength
  }
  return whole
}

// A stream cut into parts of exactly 8 MiB, then the rest. A stream that stops early is
// cancelled, so its source is let go.
async function* streamParts(stream: ReadableStream): AsyncGenerator<Uint8Array> {
  const reader = stream.getReader()
  let done = false
  let held: Uint8Array[] = []
  let size = 0
  try {
    for (let next = await reader.read(); !next.done; next = await reader.read()) {
      if (!(next.value instanceof Uint8Array)) throw new Error('A stream part is not bytes')
      let chunk: Uint8Array = next.value
      while (size + chunk.byteLength >= PART) {
        const take = PART - size
        yield joined([...held, chunk.subarray(0, take)], PART)
        held = []
        size = 0
        chunk = chunk.subarray(take)
      }
      if (chunk.byteLength > 0) {
        held.push(chunk)
        size += chunk.byteLength
      }
    }
    done = true
    if (size > 0) yield joined(held, size)
  } finally {
    if (!done) await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}

function* byteParts(data: Uint8Array): Generator<Uint8Array> {
  for (let at = 0; at < data.byteLength; at += PART) yield data.subarray(at, at + PART)
}

export async function upload(
  calls: DropboxCalls,
  path: string,
  data: ReadableStream | Uint8Array,
): Promise<void> {
  if (data instanceof Uint8Array && data.byteLength <= SINGLE_UPLOAD_MAX) {
    await calls.answer(await calls.content('upload', commitOf(path), data), z.unknown())
    return
  }
  const empty = new Uint8Array(0)
  const started = await calls.content('sessionStart', { close: false }, empty)
  const { session_id } = await calls.answer(started, Session)
  let offset = 0
  const parts = data instanceof Uint8Array ? byteParts(data) : streamParts(data)
  for await (const part of parts) {
    const arg = { cursor: { session_id, offset }, close: false }
    await calls.answer(await calls.content('sessionAppend', arg, part), z.unknown())
    offset += part.byteLength
  }
  const arg = { cursor: { session_id, offset }, commit: commitOf(path) }
  await calls.answer(await calls.content('sessionFinish', arg, empty), z.unknown())
}
