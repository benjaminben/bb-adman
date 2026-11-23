// A run that starts from a picture sends that picture first, so it counts toward the pictures
// a ComfyUI workflow takes. The command's refusal speaks of reference pictures only, which
// reads wrong to a person who chose one reference and a start picture. This rewrites that
// one refusal's sentence for the run dialog; the reason and the limit are kept. Pure.
import type { Result } from '@/shared/schemas/result'

function sentence(max: number, chosen: number): string {
  const counts = 'and the picture you start from counts as one.'
  const end = 'or start from a prompt only.'
  if (max === 1) {
    const what = chosen === 1 ? 'the reference picture' : 'the reference pictures'
    return `ComfyUI takes one picture for this run, ${counts} Remove ${what}, ${end}`
  }
  return `ComfyUI takes at most ${max} pictures for this run, ${counts} Remove a reference picture, ${end}`
}

export function startCountsReply<T>(
  reply: Result<T>,
  hasStart: boolean,
  chosen: number,
): Result<T> {
  if (reply.ok || !hasStart || chosen === 0) return reply
  const { reason, max } = reply.error.details ?? {}
  if (reason !== 'too_many_references' || typeof max !== 'number') return reply
  return { ok: false, error: { ...reply.error, message: sentence(max, chosen) } }
}
