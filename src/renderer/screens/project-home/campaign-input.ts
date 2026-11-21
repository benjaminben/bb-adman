// Subject IDs for a parsed brief (SPEC 14 1.43 T-1; spec/brief-and-templates.md, "What the
// project page sends today"). Pure. The brief form model (brief-form-model.ts) uses them.
import type { BriefDraft } from '@/shared/schemas/brief'

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
