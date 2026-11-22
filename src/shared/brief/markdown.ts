// Round 2 plan D2 [A-342]: reads a brief written as Markdown, line by line, by fixed rules
// (no AI). Pure; never throws; reads no file; one pass with no recursion. Every record is a
// Map until the end, where Object.fromEntries makes own keys only, so a language such as
// "__proto__" cannot reach a prototype. The labels are in markdown-labels.ts.
import type { BriefDraft } from '@/shared/schemas/brief'
import { fail, type Result } from '@/shared/schemas/result'
import { briefDraftFrom, BRIEF_UNREADABLE } from './draft'
import {
  copyLabel,
  fence,
  heading,
  labelLine,
  listItem,
  subjectLabel,
  topLabel,
  type CopyField,
  type ListField,
  type SubjectField,
  type TextField,
  type TopLabel,
} from './markdown-labels'

type Paragraphs = string[][]
type Subject = Map<SubjectField, string | string[]>
type WordField = 'requiredWords' | 'prohibitedWords'
type Section =
  | { kind: 'top' }
  | { kind: 'ignored' }
  | { kind: 'text'; paragraphs: Paragraphs }
  | { kind: 'list'; items: string[] }
  | { kind: 'subjects'; subject: Subject | null }
  | { kind: 'copy'; entry: Map<CopyField, string> }

const BYTE_ORDER_MARK = String.fromCharCode(0xfeff)
const TOP: Section = { kind: 'top' }
const IGNORED: Section = { kind: 'ignored' }

// Rule 6: each claim gives a place to write the first time and null after that.
class Collected {
  readonly texts = new Map<TextField, Paragraphs>()
  readonly lists = new Map<ListField, string[]>()
  readonly words = new Map<WordField, Map<string, string[]>>()
  readonly copies = new Map<string, Map<CopyField, string>>()
  subjects: Subject[] | null = null

  text(field: TextField): Paragraphs | null {
    if (this.texts.has(field)) return null
    const paragraphs: Paragraphs = [[]]
    this.texts.set(field, paragraphs)
    return paragraphs
  }

  list(field: ListField, lang?: string): string[] | null {
    if (this.lists.has(field)) return null
    const isWords = field === 'requiredWords' || field === 'prohibitedWords'
    if (!isWords || lang === undefined)
      return isWords && this.words.has(field) ? null : this.newList(field)
    const byLang = this.words.get(field) ?? new Map<string, string[]>()
    if (byLang.has(lang)) return null
    const items: string[] = []
    this.words.set(field, byLang.set(lang, items))
    return items
  }

  section(label: TopLabel): Section {
    if (label.kind === 'text') return textSection(this.text(label.field))
    if (label.kind === 'list') {
      const items = this.list(label.field, label.lang)
      return items === null ? IGNORED : { kind: 'list', items }
    }
    if (label.kind === 'copy') {
      if (this.copies.has(label.lang)) return IGNORED
      const entry = new Map<CopyField, string>()
      this.copies.set(label.lang, entry)
      return { kind: 'copy', entry }
    }
    if (this.subjects !== null) return IGNORED
    this.subjects = []
    return { kind: 'subjects', subject: null }
  }

  private newList(field: ListField): string[] {
    const items: string[] = []
    this.lists.set(field, items)
    return items
  }
}

const textSection = (paragraphs: Paragraphs | null): Section =>
  paragraphs === null ? IGNORED : { kind: 'text', paragraphs }

// Rule 3: a list given on one line is split on commas, each part trimmed, empty ones dropped.
const splitList = (value: string): string[] =>
  value
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')

function newSubject(
  section: Section & { kind: 'subjects' },
  collected: Collected,
  name: string,
): Subject {
  const subject: Subject = new Map([['name', name]])
  collected.subjects?.push(subject)
  section.subject = subject
  return subject
}

class Walk {
  readonly collected = new Collected()
  private section: Section = TOP
  private list: string[] | null = null

  heading(level: number, text: string): void {
    this.list = null
    if (level <= 2) {
      const label = topLabel(text)
      if (label !== null) this.section = this.collected.section(label)
      else if (level === 2) this.section = IGNORED
      else {
        this.collected.text('campaignName')?.[0]?.push(text)
        this.section = TOP
      }
    } else if (level === 3 && this.section.kind === 'subjects') {
      newSubject(this.section, this.collected, text)
    }
  }

  line(line: string): void {
    const section = this.section
    if (line.trim() === '') {
      if (section.kind === 'text' && section.paragraphs.at(-1)?.length) section.paragraphs.push([])
      return
    }
    if (section.kind === 'ignored') return
    const pair = labelLine(line)
    if (pair !== null && this.label(pair.label, pair.value)) return
    const item = listItem(line)
    if (item !== null) return this.item(item, line)
    this.list = null
    if (section.kind === 'text') section.paragraphs.at(-1)?.push(line.trim())
  }

  // Rule 3, with the labels of the section the line is in. True when the label is known.
  private label(raw: string, value: string): boolean {
    const section = this.section
    if (section.kind === 'copy') {
      const field = copyLabel(raw)
      if (field !== null && value !== '' && !section.entry.has(field))
        section.entry.set(field, value)
      return field !== null && this.closeList()
    }
    if (section.kind === 'subjects')
      return section.subject !== null && this.subjectLabel(section.subject, raw, value)
    const label = topLabel(raw)
    if (label?.kind === 'text') {
      if (value !== '') this.collected.text(label.field)?.[0]?.push(value)
      return this.closeList()
    }
    if (label?.kind !== 'list') return false
    this.fillList(this.collected.list(label.field, label.lang), value)
    return true
  }

  private subjectLabel(subject: Subject, raw: string, value: string): boolean {
    const field = subjectLabel(raw)
    if (field === null) return false
    if (field === 'pictures')
      this.fillList(subject.has(field) ? null : subject.set(field, []).get(field), value)
    else if (value !== '' && !subject.has(field)) subject.set(field, value)
    if (field !== 'pictures') this.closeList()
    return true
  }

  // A value fills the list now; an empty one opens it for the items that follow. A list
  // already given takes the items into nothing.
  private fillList(items: string | string[] | null | undefined, value: string): void {
    const target = Array.isArray(items) ? items : []
    if (value !== '') {
      target.push(...splitList(value))
      this.list = null
    } else this.list = target
  }

  private closeList(): true {
    this.list = null
    return true
  }

  // Rule 4: the open list first, then the section's own list, then a subject by name.
  private item(item: string, line: string): void {
    const section = this.section
    if (this.list !== null) {
      if (item !== '') this.list.push(item)
    } else if (section.kind === 'list') {
      if (item !== '') section.items.push(item)
    } else if (section.kind === 'subjects' && section.subject === null) {
      if (item !== '')
        this.collected.subjects?.push(new Map<SubjectField, string>([['name', item]]))
    } else if (section.kind === 'text') section.paragraphs.at(-1)?.push(line.trim())
  }
}

const joined = (paragraphs: Paragraphs): string =>
  paragraphs
    .filter((lines) => lines.length > 0)
    .map((lines) => lines.join(' '))
    .join('\n\n')
    .trim()

const filled = <T>(entries: Iterable<[string, T]>, keep: (value: T) => boolean): [string, T][] =>
  [...entries].filter(([, value]) => keep(value))

const notEmpty = (value: string | string[] | Map<unknown, unknown>): boolean =>
  (value instanceof Map ? value.size : value.length) > 0

function draftOf(collected: Collected): Record<string, unknown> {
  const draft: Record<string, unknown> = {}
  for (const [field, paragraphs] of collected.texts)
    if (joined(paragraphs) !== '') draft[field] = joined(paragraphs)
  for (const [field, items] of collected.lists) if (items.length > 0) draft[field] = items
  for (const [field, byLang] of collected.words) {
    const lists = filled(byLang, notEmpty)
    if (lists.length > 0) draft[field] = Object.fromEntries(lists)
  }
  const copies = filled(collected.copies, notEmpty)
  if (copies.length > 0)
    draft.copy = Object.fromEntries(
      copies.map(([lang, entry]) => [lang, Object.fromEntries(entry)]),
    )
  const subjects = collected.subjects ?? []
  if (subjects.length > 0)
    draft.subjects = subjects.map((s) => Object.fromEntries(filled(s, notEmpty)))
  return draft
}

export function parseMarkdownBrief(text: string): Result<BriefDraft> {
  const walk = new Walk()
  let inFence = false
  const body = text.startsWith(BYTE_ORDER_MARK) ? text.slice(1) : text
  for (const raw of body.split('\n')) {
    const line = raw.endsWith('\r') ? raw.slice(0, -1) : raw
    if (fence(line)) inFence = !inFence
    else if (!inFence) {
      const found = heading(line)
      if (found !== null) walk.heading(found.level, found.text)
      else walk.line(line)
    }
  }
  const draft = draftOf(walk.collected)
  return Object.keys(draft).length === 0 ? fail(BRIEF_UNREADABLE) : briefDraftFrom(draft)
}
