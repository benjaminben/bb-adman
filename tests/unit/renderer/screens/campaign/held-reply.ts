// A command reply the test holds open until it calls `release` (SPEC 14 1.48 TL-2).
import type { Result } from '../../../../../src/shared/schemas/result'

export function heldReply() {
  let release: (result: Result<unknown>) => void = () => {}
  const reply = new Promise<Result<unknown>>((resolve) => {
    release = resolve
  })
  return { answer: () => reply, release: (result: Result<unknown>) => release(result) }
}

export const REFUSED: Result<unknown> = {
  ok: false,
  error: { code: 'RULE_VIOLATION', message: 'The run was refused.' },
}
