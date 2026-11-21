import { BRIEF_TEST_BYTES as MAX_BRIEF_BYTES } from './test-size'

// SPEC 14 P3, Q4: the helper the timed tests share. Counts UTF-8 bytes.
const encoder = new TextEncoder()
export const byteLength = (text: string): number => encoder.encode(text).length

// Repeats `unit` between `head` and `tail` while the text stays under `limit` bytes.
export function fill(
  head: string,
  unit: (i: number) => string,
  tail: string,
  sep = '',
  limit = MAX_BRIEF_BYTES - 16,
): string {
  const parts: string[] = []
  let length = byteLength(head) + byteLength(tail)
  for (let i = 0; ; i += 1) {
    const part = (i > 0 ? sep : '') + unit(i)
    const size = byteLength(part)
    if (length + size > limit) break
    parts.push(part)
    length += size
  }
  return head + parts.join('') + tail
}
