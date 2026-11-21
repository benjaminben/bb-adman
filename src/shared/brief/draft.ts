// SPEC 6.1 and 14 [1.9] slice B shapes: the step parseBrief takes once JSON or YAML has
// given a value. Pure; never throws. Only an object at the top is a brief; anything else is
// brief_unreadable (SPEC 4.1), and the error holds none of the brief's text. Unknown fields
// and fields of the wrong type are dropped by the frozen BriefDraft schema.
import { BriefDraft } from '../schemas/brief'
import { fail, ok, type ErrorBody, type Result } from '../schemas/result'

export const BRIEF_UNREADABLE: ErrorBody = {
  code: 'INVALID_INPUT',
  message: 'The brief is malformed. It could not be read as JSON or YAML.',
  details: { reason: 'brief_unreadable' },
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

export function briefDraftFrom(value: unknown): Result<BriefDraft> {
  if (!isObject(value)) return fail(BRIEF_UNREADABLE)
  const draft = BriefDraft.safeParse(value)
  return draft.success ? ok(draft.data) : fail(BRIEF_UNREADABLE)
}
