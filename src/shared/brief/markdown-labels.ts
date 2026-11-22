// Round 2 plan D2 [A-342]: the Markdown brief's label table, its one owner, and the reading
// of one line into a heading, a `Label: value` line or a list item. Pure; never throws. Maps,
// not plain objects, so a label such as "constructor" finds nothing. No regular expression
// here can backtrack: each is anchored and its parts cannot overlap.

export type TextField =
  'campaignName' | 'region' | 'audience' | 'message' | 'offer' | 'callToAction' | 'tone'
export type ListField = 'languages' | 'sizes' | 'requiredWords' | 'prohibitedWords'
export type SubjectField = 'id' | 'name' | 'description' | 'pictures'
export type CopyField = 'headline' | 'callToAction'

export type TopLabel =
  | { kind: 'text'; field: TextField }
  | { kind: 'list'; field: ListField; lang?: string }
  | { kind: 'subjects' }
  | { kind: 'copy'; lang: string }

const TEXT_LABELS = new Map<string, TextField>([
  ['campaign name', 'campaignName'],
  ['campaign', 'campaignName'],
  ['region', 'region'],
  ['audience', 'audience'],
  ['message', 'message'],
  ['offer', 'offer'],
  ['call to action', 'callToAction'],
  ['tone', 'tone'],
])
const LIST_LABELS = new Map<string, ListField>([
  ['languages', 'languages'],
  ['sizes', 'sizes'],
  ['required words', 'requiredWords'],
  ['prohibited words', 'prohibitedWords'],
])
const WORD_LISTS = new Set(['required words', 'prohibited words'])
const SUBJECT_LABELS = new Map<string, SubjectField>([
  ['id', 'id'],
  ['name', 'name'],
  ['description', 'description'],
  ['pictures', 'pictures'],
  ['picture', 'pictures'],
])
const COPY_LABELS = new Map<string, CopyField>([
  ['headline', 'headline'],
  ['call to action', 'callToAction'],
])

const MARKS = ['**', '__']

// `**` or `__` around the text go; runs of spaces count as one; letter case is ignored.
function unmarked(text: string): string {
  const trimmed = text.trim()
  const mark = MARKS.find(
    (m) => trimmed.length >= 4 && trimmed.startsWith(m) && trimmed.endsWith(m),
  )
  return mark === undefined ? trimmed : trimmed.slice(2, -2).trim()
}

export const normalLabel = (text: string): string =>
  unmarked(text).replace(/\s+/g, ' ').toLowerCase()

// "required words (en)": the label and the language in the brackets, or null.
function withLanguage(label: string): { base: string; lang: string } | null {
  const open = label.indexOf('(')
  if (open < 0 || !label.endsWith(')')) return null
  const lang = label.slice(open + 1, -1).trim()
  return lang === '' ? null : { base: label.slice(0, open).trim(), lang }
}

// The language keeps the letters as written; only the label part ignores case.
function languageOf(raw: string): string {
  const text = unmarked(raw)
  return text.slice(text.indexOf('(') + 1, -1).trim()
}

export function topLabel(raw: string): TopLabel | null {
  const label = normalLabel(raw)
  const text = TEXT_LABELS.get(label)
  if (text !== undefined) return { kind: 'text', field: text }
  const list = LIST_LABELS.get(label)
  if (list !== undefined) return { kind: 'list', field: list }
  if (label === 'subjects') return { kind: 'subjects' }
  const parts = withLanguage(label)
  if (parts === null) return null
  const lang = languageOf(raw)
  if (parts.base === 'copy') return { kind: 'copy', lang }
  const words = LIST_LABELS.get(parts.base)
  return words !== undefined && WORD_LISTS.has(parts.base)
    ? { kind: 'list', field: words, lang }
    : null
}

export const subjectLabel = (raw: string): SubjectField | null =>
  SUBJECT_LABELS.get(normalLabel(raw)) ?? null

export const copyLabel = (raw: string): CopyField | null =>
  COPY_LABELS.get(normalLabel(raw)) ?? null

// A heading: one to six `#`, a space, then text. A trailing `:` on the text goes.
export function heading(line: string): { level: number; text: string } | null {
  const match = /^(#{1,6}) (.*)$/.exec(line)
  if (match === null) return null
  const text = unmarked(match[2])
  const label = text.endsWith(':') ? text.slice(0, -1).trimEnd() : text
  return label === '' ? null : { level: match[1].length, text: label }
}

// `Label: value`, `**Label:** value` or `**Label**: value`; the label is not yet looked up.
export function labelLine(line: string): { label: string; value: string } | null {
  const text = line.trim()
  const mark = MARKS.find((m) => text.startsWith(m))
  const close = mark === undefined ? -1 : text.indexOf(mark, 2)
  if (mark !== undefined && close > 2) {
    const inner = text.slice(2, close)
    const after = text.slice(close + 2)
    if (inner.endsWith(':')) return { label: inner.slice(0, -1), value: after.trim() }
    const rest = after.trimStart()
    if (rest.startsWith(':')) return { label: inner, value: rest.slice(1).trim() }
  }
  const colon = text.indexOf(':')
  return colon < 0 ? null : { label: text.slice(0, colon), value: text.slice(colon + 1).trim() }
}

// A list item: `- `, `* `, `+ ` or a number and `. `, after any indent. Its text, trimmed.
export function listItem(line: string): string | null {
  const match = /^\s*(?:[-*+]|\d+\.) (.*)$/.exec(line)
  return match === null ? null : match[1].trim()
}

export function fence(line: string): boolean {
  const text = line.trimStart()
  return text.startsWith('```') || text.startsWith('~~~')
}
