// The brief form's problem lines, in the ruled order (spec/screens-campaign.md, "The brief
// form", Problems), and the last check against the shared campaign.create schema. Pure.
import {
  campaignCreateInput,
  type CampaignCreateInput,
  type CampaignSize,
} from '@/shared/schemas/commands/campaign'
import { SubjectId } from '@/shared/schemas/commands/subject'
import { isRightToLeft } from '@/shared/brief/languages'
import { starterTemplate } from '@/shared/templates/starter'
import { briefSubjectIds } from '@/renderer/screens/project-home/campaign-input'
import type { BriefFormValues, SubjectChoice } from './brief-form-model'

// Each row's ID: the chosen subject's, the typed one, or (a new row with a blank ID and a
// name) one made from the name with briefSubjectIds, stepping around the other rows' IDs.
// A blank ID with a blank name stays empty, so only the name line shows for it.
export function subjectIds(subjects: SubjectChoice[]): string[] {
  const made = briefSubjectIds(
    subjects.map((s) => {
      const typed = s.mode === 'new' ? s.newId : (s.existingId ?? '')
      const blank = s.mode === 'new' && typed === '' && s.name.trim() !== ''
      return { name: s.name, id: blank ? undefined : typed }
    }),
  )
  return made.map((m) => m.id)
}

type Read = {
  heldSubjectIds: string[]
  languages: string[]
  sizes: CampaignSize[]
  unread: string[]
}

const REQUIRED: [keyof BriefFormValues, string][] = [
  ['campaignName', 'Enter the campaign name.'],
  ['region', 'Enter the region.'],
  ['audience', 'Enter the audience.'],
  ['message', 'Enter the message.'],
]

// Each kind of subject problem over every row in turn, then the next kind.
function subjectProblems(subjects: SubjectChoice[], held: string[]): string[] {
  const ids = subjectIds(subjects)
  const rows = subjects.map((s, i) => ({ s, n: i + 1, id: ids[i] ?? '' }))
  const fresh = rows.filter(({ s, id }) => s.mode === 'new' && id !== '')
  const goodId = (id: string) => SubjectId.safeParse(id).success
  return [
    ...(subjects.length === 0 ? ['Add at least one subject.'] : []),
    ...rows.filter(({ s }) => s.name.trim() === '').map(({ n }) => `Subject ${n}: enter a name.`),
    ...fresh
      .filter(({ id }) => !goodId(id))
      .map(
        ({ n, id }) =>
          `Subject ${n}: the ID "${id}" may hold only A-Z, a-z, 0-9, - and _, up to 64 letters.`,
      ),
    ...fresh
      .filter(({ id }) => held.includes(id))
      .map(
        ({ n, id }) =>
          `Subject ${n}: the ID "${id}" is already in this project. Choose "Use a subject this project has", or another ID.`,
      ),
    ...rows.flatMap(({ n, id }) => {
      const first = rows.find((r) => r.n < n && r.id === id && id !== '')
      return first ? [`Subjects ${first.n} and ${n} have the same ID.`] : []
    }),
    ...rows
      .filter(({ s }) => s.mode === 'existing' && s.existingId === null)
      .map(({ n }) => `Subject ${n}: choose a subject.`),
  ]
}

export function formProblems(values: BriefFormValues, read: Read): string[] {
  return [
    ...REQUIRED.filter(([key]) => String(values[key]).trim() === '').map(([, line]) => line),
    ...subjectProblems(values.subjects, read.heldSubjectIds),
    ...(read.sizes.length === 0 && read.unread.length === 0 ? ['Choose at least one size.'] : []),
    ...read.unread.map((text) => `The size "${text}" cannot be read.`),
    ...(read.languages.length === 0 ? ['Give at least one language.'] : []),
    ...(read.languages.some(isRightToLeft)
      ? ['Right-to-left languages are not supported yet.']
      : []),
    ...(values.rules.mode === 'copy' && values.rules.copyFrom === null
      ? ['Choose a campaign to copy the rules from.']
      : []),
  ]
}

type Checked = { ok: true; campaign: CampaignCreateInput } | { ok: false; problems: string[] }

// The whole input must pass the shared schema; any issue left is shown by its own message.
export function schemaCheck(input: Omit<CampaignCreateInput, 'templateId'>): Checked {
  const parsed = campaignCreateInput.safeParse({ ...input, templateId: starterTemplate.id })
  if (parsed.success) return { ok: true, campaign: parsed.data }
  return { ok: false, problems: [...new Set(parsed.error.issues.map((i) => i.message))] }
}
