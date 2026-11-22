// Review leftovers, "Publish": a local file read under a byte limit. The read stops as soon as
// the count passes the limit, so a file that grows while it is read is still refused.
import fs from 'node:fs/promises'
import { tooLarge } from '@/main/providers/read-limited'

const CHUNK = 64 * 1024

export async function readFileUnder(file: string, limit: number): Promise<Uint8Array> {
  const handle = await fs.open(file, 'r')
  try {
    const chunks: Uint8Array[] = []
    let count = 0
    for (;;) {
      const chunk = new Uint8Array(Math.min(CHUNK, limit - count + 1))
      const { bytesRead } = await handle.read(chunk, 0, chunk.length, null)
      if (bytesRead === 0) break
      count += bytesRead
      if (count > limit) throw tooLarge()
      chunks.push(chunk.subarray(0, bytesRead))
    }
    const whole = new Uint8Array(count)
    let at = 0
    for (const chunk of chunks) {
      whole.set(chunk, at)
      at += chunk.byteLength
    }
    return whole
  } finally {
    await handle.close()
  }
}
