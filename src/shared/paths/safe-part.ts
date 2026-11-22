// One owner of the safe-name rule (spec/phases/phase-09.md Q-P9-3): text a user typed, made into
// one storage path part. Each character outside A-Z a-z 0-9 + - _ space becomes '-', spaces are
// trimmed, the name is cut to 80, empty gives the fallback, a reserved device name gets
// '{fallback}-' in front. With fallback 'post' it gives exactly what Phase 8's postTitle gives
// (src/shared/export/safe-title.ts); safe-part.test.ts keeps the two equal.
import { isReserved } from '@/shared/config/reserved-names'

const KEPT = /^[A-Za-z0-9+\-_ ]$/
const MAX = 80
const FALLBACK = /^[A-Za-z0-9_-]{1,20}$/

const trimSpaces = (text: string) => text.replace(/^ +| +$/g, '')

// The storage path rules for one part (spec/storage-and-publish.md "Path rules", built in
// src/main/providers/storage-paths.ts, which src/shared may not import): not empty, '.' or '..';
// no '/', '\', ':', '<', '>', '"', '|', '?', '*' or code 0 to 31; no trailing dot or space; not a
// reserved device name.
const NOT_IN_PARTS = new Set(['/', '\\', ':', '<', '>', '"', '|', '?', '*'])

export function isSafePart(part: string): boolean {
  if (part === '' || part === '.' || part === '..') return false
  if (part.endsWith('.') || part.endsWith(' ')) return false
  if ([...part].some((c) => NOT_IN_PARTS.has(c) || c.charCodeAt(0) < 32)) return false
  return !isReserved(part)
}

export function safePathPart(text: string, fallback: string): string {
  if (!FALLBACK.test(fallback) || isReserved(fallback)) {
    throw new Error('safePathPart was given a fallback it cannot use')
  }
  const kept = [...text].map((c) => (KEPT.test(c) ? c : '-')).join('')
  const name = trimSpaces(trimSpaces(kept).slice(0, MAX))
  if (name === '') return fallback
  return isReserved(name) ? `${fallback}-${name}` : name
}
