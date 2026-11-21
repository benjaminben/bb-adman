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

// The brief.parse reply. Slice C declares it as BriefParsed in src/main/commands/brief/
// parse.ts, which the window may not import; this reads the same two fields.
export type BriefReply = { draft: BriefDraft; primaryLanguage: string | null }

export type CampaignPlan =
  | { ok: true; subjects: SubjectCreateInput[]; campaign: CampaignCreateInput }
  | { ok: false; problems: string[] }

function subjectProblems(draft: BriefDraft): string[] {
  return (draft.subjects ?? []).flatMap((s) => {
    if (s.id === undefined) return [`The subject "${s.name ?? ''}" has no ID in the brief.`]
    if (SubjectId.safeParse(s.id).success) return []
    return [`The subject ID "${s.id}" may hold only A-Z, a-z, 0-9, - and _, up to 64 letters.`]
  })
}

function languagesOf(reply: BriefReply): string[] {
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
  reply: BriefReply,
  existingSubjectIds: string[],
): CampaignPlan {
  const { draft } = reply
  const languages = languagesOf(reply)
  const { sizes, unread } = sizesOf(draft)
  const problems = [
    ...subjectProblems(draft),
    ...(languages.length === 0 ? ['The brief gives no language.'] : []),
    ...unread.map((text) => `The size "${text}" cannot be read.`),
  ]
  if (problems.length > 0) return { ok: false, problems }
  const briefSubjects = draft.subjects ?? []
  const parsed = campaignCreateInput.safeParse({
    projectId,
    brief: draft,
    subjectMap: briefSubjects.map((s) => ({ subjectId: s.id ?? '', create: false })),
    languages,
    sizes,
    templateId: starterTemplate.id,
  })
  if (!parsed.success) return { ok: false, problems: problemsOf(parsed.error.issues) }
  const seen = new Set(existingSubjectIds)
  const subjects: SubjectCreateInput[] = []
  for (const s of briefSubjects) {
    if (s.id === undefined || seen.has(s.id)) continue
    seen.add(s.id)
    subjects.push({ projectId, id: s.id, name: s.name ?? '', description: s.description ?? '' })
  }
  return { ok: true, subjects, campaign: parsed.data }
}
