// What "Create campaign" sends for a parsed brief (SPEC 14 1.41 TP-1; SPEC 6.1). Pure.
// The defaults are the ones Section 6.1 gives the MCP tool: the brief's own languages and
// sizes, otherwise the region table's language and the ready-made sizes picked by default.
// No rule set is sent, so it holds the brief's words. Every subject is made first with
// subject.create, so each map entry names an existing subject. Nothing is sent unless the
// whole input passes the shared campaign.create schema.
import type { BriefDraft } from '../../../shared/schemas/brief'
import {
  campaignCreateInput,
  type CampaignCreateInput,
  type CampaignSize,
} from '../../../shared/schemas/commands/campaign'
import { SubjectId, type SubjectCreateInput } from '../../../shared/schemas/commands/subject'
import { parseSize } from '../../../shared/brief/size'
import { READY_MADE_SIZES } from '../../../shared/config/defaults'
import { starterTemplate } from '../../../shared/templates/starter'
import type { BriefParsed } from '../../../shared/schemas/commands/brief'

export type CampaignPlan =
  | { ok: true; subjects: SubjectCreateInput[]; campaign: CampaignCreateInput }
  | { ok: false; problems: string[] }

type DraftSubject = NonNullable<BriefDraft['subjects']>[number]
export type BriefSubjectId = { id: string; made: boolean }

const MAX_ID = 64

// SPEC 14 1.43 T-1: spaces become "-", other characters outside the SubjectId set go, the
// rest is cut to 64; an empty result is "subject".
function idFromName(name: string): string {
  const id = name
    .replace(/ +/g, '-')
    .replace(/[^A-Za-z0-9_-]/g, '')
    .slice(0, MAX_ID)
  return id === '' ? 'subject' : id
}

// Each brief subject's ID: its own when the brief gives one (kept as it is, even if bad), or
// one made from its name. A made ID that an earlier subject or a brief's own ID already uses
// gets "-2", "-3" and so on, cut so the whole fits 64.
export function briefSubjectIds(subjects: DraftSubject[]): BriefSubjectId[] {
  const given = new Set(subjects.flatMap((s) => (s.id === undefined ? [] : [s.id])))
  const taken = new Set<string>()
  return subjects.map((s) => {
    if (s.id !== undefined) return { id: s.id, made: false }
    const base = idFromName(s.name ?? '')
    let id = base
    for (let n = 2; given.has(id) || taken.has(id); n++) {
      const end = `-${n}`
      id = base.slice(0, MAX_ID - end.length) + end
    }
    taken.add(id)
    return { id, made: true }
  })
}

function subjectProblems(ids: BriefSubjectId[]): string[] {
  return ids.flatMap(({ id, made }) =>
    made || SubjectId.safeParse(id).success
      ? []
      : [`The subject ID "${id}" may hold only A-Z, a-z, 0-9, - and _, up to 64 letters.`],
  )
}

function languagesOf(reply: BriefParsed): string[] {
  const own = reply.draft.languages ?? []
  if (own.length > 0) return own
  return reply.primaryLanguage ? [reply.primaryLanguage] : []
}

function sizesOf(draft: BriefDraft): { sizes: CampaignSize[]; unread: string[] } {
  const own = draft.sizes ?? []
  if (own.length === 0) {
    const picked = READY_MADE_SIZES.filter((s) => s.selectedByDefault)
    return {
      sizes: picked.map(({ label, width, height }) => ({ label, width, height })),
      unread: [],
    }
  }
  const sizes: CampaignSize[] = []
  const unread: string[] = []
  for (const text of own) {
    const size = parseSize(text)
    if (size) sizes.push(size)
    else unread.push(text)
  }
  return { sizes, unread }
}

function problemsOf(issues: { path: PropertyKey[]; message: string }[]): string[] {
  const lines = issues.map((issue) =>
    issue.path[0] === 'brief' && issue.path[1] !== undefined
      ? `The brief's "${String(issue.path[1])}" is missing or empty.`
      : issue.message,
  )
  return [...new Set(lines)]
}

export function campaignPlan(
  projectId: string,
  reply: BriefParsed,
  existingSubjectIds: string[],
): CampaignPlan {
  const { draft } = reply
  const languages = languagesOf(reply)
  const { sizes, unread } = sizesOf(draft)
  const briefSubjects = draft.subjects ?? []
  const ids = briefSubjectIds(briefSubjects)
  const problems = [
    ...subjectProblems(ids),
    ...(languages.length === 0 ? ['The brief gives no language.'] : []),
    ...unread.map((text) => `The size "${text}" cannot be read.`),
  ]
  if (problems.length > 0) return { ok: false, problems }
  const parsed = campaignCreateInput.safeParse({
    projectId,
    brief: draft,
    subjectMap: ids.map(({ id }) => ({ subjectId: id, create: false })),
    languages,
    sizes,
    templateId: starterTemplate.id,
  })
  if (!parsed.success) return { ok: false, problems: problemsOf(parsed.error.issues) }
  const seen = new Set(existingSubjectIds)
  const subjects: SubjectCreateInput[] = []
  briefSubjects.forEach((s, i) => {
    const id = ids[i]?.id
    if (id === undefined || seen.has(id)) return
    seen.add(id)
    subjects.push({ projectId, id, name: s.name ?? '', description: s.description ?? '' })
  })
  return { ok: true, subjects, campaign: parsed.data }
}
