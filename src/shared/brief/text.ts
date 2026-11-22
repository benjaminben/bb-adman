// Round 2 plan D1 [A-340, A-341]: reads a brief given as text, with no file ending to say its
// form: JSON, then YAML, then Markdown. The text may come from anyone, so it is read as
// hostile: parseBrief's YAML rules stay as they are, no reader runs code or reads a file, and
// the one error holds none of the text (no bad line: the caller sent the text). Pure; never
// throws; no AI call; no size limit (D-059 item 2).
import type { BriefDraft } from '@/shared/schemas/brief'
import { fail, ok, type ErrorBody, type Result } from '@/shared/schemas/result'
import { parseBrief } from './parse'
import { parseMarkdownBrief } from './markdown'

export type BriefTextSyntax = 'json' | 'yaml' | 'markdown'

export const BRIEF_TEXT_UNREADABLE: ErrorBody = {
  code: 'INVALID_INPUT',
  message: 'The brief could not be read as JSON, YAML or Markdown.',
  details: { reason: 'brief_unreadable' },
}

const hasField = (draft: BriefDraft): boolean =>
  Object.values(draft).some((value) => value !== undefined)

function read(text: string): Result<{ draft: BriefDraft; syntax: BriefTextSyntax }> {
  const json = parseBrief(text, 'json')
  if (json.ok) return ok({ draft: json.data, syntax: 'json' })
  // Markdown such as `Region: Canada` is YAML with an unknown key: an empty draft falls through.
  const yaml = parseBrief(text, 'yaml')
  if (yaml.ok && hasField(yaml.data)) return ok({ draft: yaml.data, syntax: 'yaml' })
  const markdown = parseMarkdownBrief(text)
  return markdown.ok
    ? ok({ draft: markdown.data, syntax: 'markdown' })
    : fail(BRIEF_TEXT_UNREADABLE)
}

export function parseBriefText(
  text: string,
): Result<{ draft: BriefDraft; syntax: BriefTextSyntax }> {
  try {
    return read(text)
  } catch {
    return fail(BRIEF_TEXT_UNREADABLE)
  }
}
