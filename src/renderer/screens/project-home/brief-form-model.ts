// The brief form's values and what "Create campaign" sends (spec/screens-campaign.md, "The
// brief form"; spec/brief-and-templates.md, "From a brief to a campaign"). Pure, no React.
// formFromDraft fills the form from a parsed brief (or opens it empty); planFromForm turns the
// form into subject.create inputs and one campaign.create input, or into problem lines.
import type { BriefDraft } from '@/shared/schemas/brief'
import type { BriefParsed } from '@/shared/schemas/commands/brief'
import type { CampaignCreateInput, CampaignSize } from '@/shared/schemas/commands/campaign'
import type { SubjectCreateInput } from '@/shared/schemas/commands/subject'
import { parseSize } from '@/shared/brief/size'
import { wordsByLanguage } from '@/shared/brief/words'
import { READY_MADE_SIZES } from '@/shared/config/defaults'
import { briefSubjectIds } from '@/renderer/screens/project-home/campaign-input'
import { formProblems, schemaCheck, subjectIdOf } from './brief-form-problems'

export type SubjectChoice = {
  name: string
  description: string
  mode: 'new' | 'existing'
  newId: string
  existingId: string | null
}

export type BriefFormValues = {
  campaignName: string
  region: string
  audience: string
  message: string
  offer: string
  callToAction: string
  tone: string
  subjects: SubjectChoice[]
  sizes: { readyMade: string[]; other: string; master: string | null }
  languages: string
  rules: {
    mode: 'words' | 'copy'
    copyFrom: string | null
    requiredWords: Record<string, string>
    prohibitedWords: Record<string, string>
  }
  copy: BriefDraft['copy']
}

export type CampaignPlan =
  | { ok: true; subjects: SubjectCreateInput[]; campaign: CampaignCreateInput }
  | { ok: false; problems: string[] }

export const emptySubject = (): SubjectChoice => ({
  name: '',
  description: '',
  mode: 'new',
  newId: '',
  existingId: null,
})

const defaultLabels = () => READY_MADE_SIZES.filter((s) => s.selectedByDefault).map((s) => s.label)
const isReadyMade = (label: string) => READY_MADE_SIZES.some((s) => s.label === label)

function sizesFromDraft(texts: string[]): BriefFormValues['sizes'] {
  if (texts.length === 0) {
    const readyMade = defaultLabels()
    return { readyMade, other: '', master: readyMade[0] ?? null }
  }
  const readyMade: string[] = []
  const other: string[] = []
  let master: string | null = null
  for (const text of texts) {
    const size = parseSize(text)
    if (size && isReadyMade(size.label)) readyMade.push(size.label)
    else other.push(size ? `${size.width}x${size.height}` : text)
    if (size && master === null) master = size.label
  }
  return { readyMade, other: other.join(', '), master }
}

function wordText(words: BriefDraft['requiredWords'], primary: string): Record<string, string> {
  if (words === undefined) return {}
  const byLanguage = wordsByLanguage(words, primary)
  return Object.fromEntries(Object.entries(byLanguage).map(([tag, list]) => [tag, list.join('\n')]))
}

export function formFromDraft(
  reply: BriefParsed | null,
  heldSubjectIds: string[],
): BriefFormValues {
  const draft: BriefDraft = reply?.draft ?? {}
  const own = draft.languages ?? []
  const languages = own.length > 0 ? own.join(', ') : (reply?.primaryLanguage ?? '')
  const primary = splitLanguages(languages)[0] ?? ''
  const draftSubjects = reply === null ? [{}] : (draft.subjects ?? [])
  const ids = briefSubjectIds(draftSubjects)
  return {
    campaignName: draft.campaignName ?? '',
    region: draft.region ?? '',
    audience: draft.audience ?? '',
    message: draft.message ?? '',
    offer: draft.offer ?? '',
    callToAction: draft.callToAction ?? '',
    tone: draft.tone ?? '',
    subjects: draftSubjects.map((s, i) => {
      const id = reply === null ? '' : (ids[i]?.id ?? '')
      const held = heldSubjectIds.includes(id)
      return {
        name: s.name ?? '',
        description: s.description ?? '',
        mode: held ? 'existing' : 'new',
        newId: id,
        existingId: held ? id : null,
      }
    }),
    sizes: sizesFromDraft(draft.sizes ?? []),
    languages,
    rules: {
      mode: 'words',
      copyFrom: null,
      requiredWords: wordText(draft.requiredWords, primary),
      prohibitedWords: wordText(draft.prohibitedWords, primary),
    },
    copy: draft.copy,
  }
}

export function splitLanguages(text: string): string[] {
  return text.split(/[\s,]+/).filter((tag) => tag !== '')
}

// The chosen sizes in order, the master first, and the typed texts that cannot be read.
export function chosenSizes(sizes: BriefFormValues['sizes']): {
  sizes: CampaignSize[]
  unread: string[]
} {
  const typed = sizes.other
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t !== '')
  const found = [...sizes.readyMade, ...typed].map((text) => ({ text, size: parseSize(text) }))
  const read = found.flatMap((f) => (f.size ? [f.size] : []))
  const master = read.findIndex((s) => s.label === sizes.master)
  if (master > 0) read.unshift(...read.splice(master, 1))
  return { sizes: read, unread: found.filter((f) => f.size === null).map((f) => f.text) }
}

// One list per language, a word or phrase per line, blank lines and empty lists left out. A
// plain list the brief gave with no language goes under the main language.
function wordLists(texts: Record<string, string>, primary: string): Record<string, string[]> {
  const lists: Record<string, string[]> = {}
  for (const [tag, text] of Object.entries(texts)) {
    const words = text
      .split('\n')
      .map((w) => w.trim())
      .filter((w) => w !== '')
    const key = tag === '' ? primary : tag
    if (words.length > 0) lists[key] = [...(lists[key] ?? []), ...words]
  }
  return lists
}

const optional = (text: string) => (text.trim() === '' ? undefined : text)
const unlessEmpty = (lists: Record<string, string[]>) =>
  Object.keys(lists).length === 0 ? undefined : lists

export function planFromForm(
  projectId: string,
  values: BriefFormValues,
  heldSubjectIds: string[],
): CampaignPlan {
  const languages = splitLanguages(values.languages)
  const { sizes, unread } = chosenSizes(values.sizes)
  const problems = formProblems(values, { heldSubjectIds, languages, sizes, unread })
  if (problems.length > 0) return { ok: false, problems }
  const primary = languages[0] ?? ''
  const { rules } = values
  const checked = schemaCheck({
    projectId,
    brief: {
      campaignName: values.campaignName,
      region: values.region,
      audience: values.audience,
      message: values.message,
      offer: optional(values.offer),
      callToAction: optional(values.callToAction),
      tone: optional(values.tone),
      subjects: values.subjects.map((s) => ({
        id: subjectIdOf(s),
        name: s.name,
        description: s.description,
      })),
      languages,
      sizes: sizes.map((s) => `${s.width}x${s.height}`),
      requiredWords: unlessEmpty(wordLists(rules.requiredWords, primary)),
      prohibitedWords: unlessEmpty(wordLists(rules.prohibitedWords, primary)),
      copy: values.copy,
    },
    subjectMap: values.subjects.map((s) => ({ subjectId: subjectIdOf(s), create: false })),
    languages,
    sizes,
    copyRuleSetFrom: rules.mode === 'copy' ? (rules.copyFrom ?? undefined) : undefined,
  })
  if (!checked.ok) return checked
  const subjects = values.subjects
    .filter((s) => s.mode === 'new')
    .map((s) => ({ projectId, id: s.newId, name: s.name, description: s.description }))
  return { ok: true, subjects, campaign: checked.campaign }
}
