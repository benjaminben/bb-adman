// What a brief an agent sends asks for (spec/phases/round-2-platform.md, D6, steps 1 to 4): the
// text read by parseBriefText only (no AI call), the confirmed brief, each subject's ID (one
// the project holds is used as it is), the pictures, and the campaign.create input with sizes
// and languages filled as an agent's create_campaign fills them. Reads the project, writes
// nothing, reads no file. The permission broker runs it before the ask and the command again
// after it, so a brief that would be refused never reaches the user's screen.
import type Database from 'better-sqlite3'
import { readWireRow } from '@/main/db/rows'
import { refuseRightToLeft } from './create'
import { briefPathTexts, checkPictures, type PicturePlan } from './from-brief-pictures'
import { checkBriefBrand, cleanBrandFields, type BrandPlan } from './from-brief-brand'
import { parseBriefText } from '@/shared/brief/text'
import { briefSubjectIds } from '@/shared/brief/subject-ids'
import { fillCreateDefaults } from '@/shared/campaign/create-defaults'
import { Brief, type BriefDraft } from '@/shared/schemas/brief'
import { campaignCreateInput, type CampaignCreateInput } from '@/shared/schemas/commands/campaign'
import type { CampaignFromBriefInput } from '@/shared/schemas/commands/campaign-brief'
import { SubjectId } from '@/shared/schemas/commands/subject'
import { AppError } from '@/shared/schemas/result'

export type PlannedSubject = { id: string; name: string; description: string; held: boolean }

export type BriefPlan = {
  create: CampaignCreateInput
  // One per brief subject, in brief order.
  subjects: PlannedSubject[]
  pictures: PicturePlan
  // The normalised full paths, in brief order (the files command only).
  paths: string[]
}

type DraftSubject = NonNullable<BriefDraft['subjects']>[number]

// The required fields and their Markdown labels, in the order the message names them.
const REQUIRED: ReadonlyArray<[keyof BriefDraft, string]> = [
  ['campaignName', 'campaign name'],
  ['region', 'region'],
  ['audience', 'audience'],
  ['message', 'message'],
]

const filled = (value: unknown) => typeof value === 'string' && value.trim() !== ''

function readDraft(text: string): BriefDraft {
  const read = parseBriefText(text)
  if (!read.ok) throw new AppError(read.error.code, read.error.message, read.error.details)
  return read.data.draft
}

// Step 2: the four required texts and at least one subject, each with a name.
function refuseIncomplete(draft: BriefDraft): void {
  const fields = REQUIRED.filter(([field]) => !filled(draft[field]))
  const subjects = draft.subjects ?? []
  const named = subjects.length > 0 && subjects.every((s) => filled(s.name))
  const missing = [...fields, ...(named ? [] : [['subjects', 'subjects'] as const])]
  if (missing.length === 0) return
  throw new AppError(
    'INVALID_INPUT',
    `The brief is missing: ${missing.map(([, label]) => label).join(', ')}.`,
    { reason: 'brief_incomplete', fields: missing.map(([field]) => field) },
  )
}

const picturesOf = (s: DraftSubject): string[] =>
  s.pictures === undefined ? [] : typeof s.pictures === 'string' ? [s.pictures] : s.pictures

// Step 3: briefSubjectIds; an ID the project holds is that subject, any other is made.
function planSubjects(db: Database.Database, subjects: DraftSubject[]): PlannedSubject[] {
  return briefSubjectIds(subjects).map(({ id }, i) => {
    const held = Boolean(readWireRow(db, 'subject', { id }))
    if (!held && !SubjectId.safeParse(id).success) {
      throw new AppError('INVALID_INPUT', 'A new subject ID may hold only A-Z, a-z, 0-9, - and _.')
    }
    const s = subjects[i]
    return { id, name: s?.name ?? '', description: s?.description ?? '', held }
  })
}

// The draft's raw brand fields, cleared before the cleaned ones go in.
const RAW_BRAND_FIELDS = {
  brand: undefined,
  layout: undefined,
  artDirection: undefined,
  adsPer: undefined,
}

// The campaign.create input, every subject already in place by run (create false). The brand
// fields of the brief are briefLook's cleaned values, never the draft's (spec/brief-brand.md).
function createInputOf(
  projectId: string,
  draft: BriefDraft,
  subjects: PlannedSubject[],
  { look, brand }: BrandPlan,
): CampaignCreateInput {
  const brief = Brief.parse({
    ...draft,
    ...RAW_BRAND_FIELDS,
    ...cleanBrandFields(look),
    subjects: subjects.map((s, i) => ({ ...draft.subjects?.[i], id: s.id })),
  })
  const filledIn = fillCreateDefaults({ brief })
  const parsed = campaignCreateInput.safeParse({
    projectId,
    brief,
    subjectMap: subjects.map((s) => ({ subjectId: s.id, create: false })),
    languages: filledIn.languages,
    sizes: filledIn.sizes,
    templateId: 'starter',
    ...(brand ? { brand } : {}),
  })
  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `${i.path.join('.') || 'input'}: ${i.message}`)
    throw new AppError('INVALID_INPUT', 'Some values are not valid.', { issues })
  }
  refuseRightToLeft(parsed.data.languages)
  return parsed.data
}

function pathsOf(pictures: PicturePlan, withFiles: boolean, platform: NodeJS.Platform) {
  if (!withFiles) return []
  if (pictures.files.length === 0) {
    throw new AppError('INVALID_INPUT', 'This brief names no file. Send it through the tool.', {
      reason: 'no_files',
    })
  }
  return briefPathTexts(
    pictures.files.map((f) => f.text),
    platform,
  )
}

export function briefPlan(
  db: Database.Database,
  input: CampaignFromBriefInput,
  withFiles: boolean,
  platform: NodeJS.Platform = process.platform,
): BriefPlan {
  const draft = readDraft(input.text)
  refuseIncomplete(draft)
  const brand = checkBriefBrand(db, draft, platform)
  const draftSubjects = draft.subjects ?? []
  const subjects = planSubjects(db, draftSubjects)
  const pictures = checkPictures(
    db,
    subjects.map((s, i) => ({ subjectId: s.id, texts: picturesOf(draftSubjects[i] ?? {}) })),
    withFiles,
    platform,
  )
  const paths = pathsOf(pictures, withFiles, platform)
  const create = createInputOf(input.projectId, draft, subjects, brand)
  return { create, subjects, pictures, paths }
}
