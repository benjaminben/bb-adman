// The brief form's values and what "Create campaign" sends (spec/screens-campaign.md, "The
// brief form"; spec/brief-and-templates.md, "From a brief to a campaign"; spec/subject-photos.md,
// "The model"; spec/brief-brand.md, "The brief form"). Pure, no React. formFromDraft fills the form from a parsed brief (or opens it
// empty); planFromForm turns the form into subject.create inputs, the asset.update list that
// attaches the photos, and one campaign.create input, or into problem lines.
import type { BriefDraft } from '@/shared/schemas/brief'
import type { BriefParsed } from '@/shared/schemas/commands/brief'
import type { AssetUpdateInput } from '@/shared/schemas/commands/asset'
import type { CampaignCreateInput } from '@/shared/schemas/commands/campaign'
import type { SubjectCreateInput } from '@/shared/schemas/commands/subject'
import { wordsByLanguage } from '@/shared/brief/words'
import { briefSubjectIds } from '@/renderer/screens/project-home/campaign-input'
import { formProblems, schemaCheck, subjectIds } from './brief-form-problems'
import { attachPlan, type ProjectImages } from './brief-form-photos'
import { chosenSizes, sizesFromDraft, type SizeChoice } from './brief-form-sizes'
import { brandFromDraft, brandPlan, type BrandChoice, type BriefBrand } from './brief-form-brand'
import { adsPerOf, type AdsPer } from '@/shared/brief/brand'

export type FormPhoto = {
  assetId: string
  added: boolean // this form imported it as a new asset; removed again if not used
}

export type SubjectChoice = {
  name: string
  description: string
  mode: 'new' | 'existing'
  newId: string
  existingId: string | null
  photos: FormPhoto[] // in the order added
  adding: boolean // an "Add photos" import is running for this row
  notes: string[] // lines about this row's photos
}

// One entry per draft subject, made by brief-load/ from the brief's checked photo paths.
export type BriefPhotos = { photos: FormPhoto[]; notes: string[] }[]

export type BriefFormValues = {
  campaignName: string
  region: string
  audience: string
  message: string
  offer: string
  callToAction: string
  tone: string
  subjects: SubjectChoice[]
  sizes: SizeChoice
  languages: string
  rules: {
    mode: 'words' | 'copy'
    copyFrom: string | null
    requiredWords: Record<string, string>
    prohibitedWords: Record<string, string>
  }
  copy: BriefDraft['copy']
  placeSubjectPhoto: boolean // a new ad starts with a subject photo placed
  brand: BrandChoice
  adsPer: AdsPer
}

export type CampaignPlan =
  | {
      ok: true
      subjects: SubjectCreateInput[]
      attach: AssetUpdateInput[]
      campaign: CampaignCreateInput
    }
  | { ok: false; problems: string[] }

export const emptySubject = (): SubjectChoice => ({
  name: '',
  description: '',
  mode: 'new',
  newId: '',
  existingId: null,
  photos: [],
  adding: false,
  notes: [],
})

function wordText(words: BriefDraft['requiredWords'], primary: string): Record<string, string> {
  if (words === undefined) return {}
  const byLanguage = wordsByLanguage(words, primary)
  return Object.fromEntries(Object.entries(byLanguage).map(([tag, list]) => [tag, list.join('\n')]))
}

export function formFromDraft(
  reply: BriefParsed | null,
  heldSubjectIds: string[],
  briefPhotos: BriefPhotos = [],
  briefBrand?: BriefBrand,
): BriefFormValues {
  const draft: BriefDraft = reply?.draft ?? {}
  const own = draft.languages ?? []
  const languages = own.length > 0 ? own.join(', ') : (reply?.primaryLanguage ?? '')
  const primary = splitLanguages(languages)[0] ?? ''
  const draftSubjects = draft.subjects ?? []
  const ids = briefSubjectIds(draftSubjects)
  const subjects = draftSubjects.map((s, i): SubjectChoice => {
    const id = ids[i]?.id ?? ''
    const held = heldSubjectIds.includes(id)
    return {
      ...emptySubject(),
      name: s.name ?? '',
      description: s.description ?? '',
      mode: held ? 'existing' : 'new',
      newId: id,
      existingId: held ? id : null,
      photos: briefPhotos[i]?.photos ?? [],
      notes: briefPhotos[i]?.notes ?? [],
    }
  })
  return {
    campaignName: draft.campaignName ?? '',
    region: draft.region ?? '',
    audience: draft.audience ?? '',
    message: draft.message ?? '',
    offer: draft.offer ?? '',
    callToAction: draft.callToAction ?? '',
    tone: draft.tone ?? '',
    subjects: reply === null ? [emptySubject()] : subjects,
    sizes: sizesFromDraft(draft.sizes ?? []),
    languages,
    rules: {
      mode: 'words',
      copyFrom: null,
      requiredWords: wordText(draft.requiredWords, primary),
      prohibitedWords: wordText(draft.prohibitedWords, primary),
    },
    copy: draft.copy,
    placeSubjectPhoto: false,
    brand: brandFromDraft(draft, briefBrand),
    adsPer: adsPerOf(draft.adsPer).adsPer,
  }
}

export function splitLanguages(text: string): string[] {
  return text.split(/[\s,]+/).filter((tag) => tag !== '')
}

// One list per language, a word or phrase per line, blank lines and empty lists left out. A
// plain list the brief gave with no language goes under the main language. Only the listed
// languages are sent: the form shows word lists for those alone.
function wordLists(texts: Record<string, string>, languages: string[]): Record<string, string[]> {
  const lists: Record<string, string[]> = {}
  for (const [tag, text] of Object.entries(texts)) {
    const words = text
      .split('\n')
      .map((w) => w.trim())
      .filter((w) => w !== '')
    const key = tag === '' ? (languages[0] ?? '') : tag
    if (words.length > 0 && languages.includes(key)) lists[key] = [...(lists[key] ?? []), ...words]
  }
  return lists
}

const optional = (text: string) => (text.trim() === '' ? undefined : text)
const unlessEmpty = (lists: Record<string, string[]>) =>
  Object.keys(lists).length === 0 ? undefined : lists

// images: the project's pictures (asset.list kind 'image'), null while not read; imagesRefused
// when that read was refused. Left out (undefined), no photo rule applies and attach is empty:
// the form's caller does not read the project's pictures yet.
export function planFromForm(
  projectId: string,
  values: BriefFormValues,
  heldSubjectIds: string[],
  images?: ProjectImages,
  imagesRefused = false,
): CampaignPlan {
  const languages = splitLanguages(values.languages)
  const { sizes, unread } = chosenSizes(values.sizes)
  const photos = images === undefined ? undefined : { images, refused: imagesRefused }
  const read = { heldSubjectIds, languages, sizes, unread, photos }
  const problems = formProblems(values, read)
  if (problems.length > 0) return { ok: false, problems }
  const { rules } = values
  const brand = brandPlan(values.brand)
  const made = subjectIds(values.subjects)
  const ids = values.subjects.map((s, i) => ({ s, id: made[i] ?? '' }))
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
      subjects: ids.map(({ s, id }) => ({ id, name: s.name, description: s.description })),
      languages,
      sizes: sizes.map((s) => `${s.width}x${s.height}`),
      requiredWords: unlessEmpty(wordLists(rules.requiredWords, languages)),
      prohibitedWords: unlessEmpty(wordLists(rules.prohibitedWords, languages)),
      copy: values.copy,
      ...brand.brief,
      // "campaign" is left out: campaign.create reads a missing adsPer as campaign.
      ...(values.adsPer === 'subject' ? { adsPer: values.adsPer } : {}),
    },
    subjectMap: ids.map(({ id }) => ({ subjectId: id, create: false })),
    languages,
    sizes,
    copyRuleSetFrom: rules.mode === 'copy' ? (rules.copyFrom ?? undefined) : undefined,
    placeSubjectPhoto: values.placeSubjectPhoto,
    ...(brand.campaign === undefined ? {} : { brand: brand.campaign }),
  })
  if (!checked.ok) return checked
  const subjects = ids
    .filter(({ s }) => s.mode === 'new')
    .map(({ s, id }) => ({ projectId, id, name: s.name, description: s.description }))
  const attach = images ? attachPlan(projectId, values.subjects, made, images) : []
  return { ok: true, subjects, attach, campaign: checked.campaign }
}
