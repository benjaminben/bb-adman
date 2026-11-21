// Answers for the campaign page tests (SPEC 14 1.41 TP-2): a campaign.get reply shaped as
// slice C returns it (SPEC 4.3 [1.42]), and template.slots.
import type { ReactElement } from 'react'
import type { CampaignGet, TemplateSlots, VariantSummary } from '@/shared/schemas/queries/campaign'
import type { AppState, ProviderInfo } from '@/shared/schemas/queries/app'
import type { JobRow } from '@/shared/schemas/rows/job'
import { baseState, makeFakeApi } from '../../fake-api'
import { renderApp } from '../../render'

export const P = '01JD00000000000000000000P1'

const NO_BADGES = {
  jobRunning: false,
  resultUnseen: false,
  outOfDate: false,
  overflow: false,
  translationUnapproved: false,
  checkWarning: false,
  checkStale: false,
  missingFile: false,
}

export function variant(id: string, over: Partial<VariantSummary> = {}): VariantSummary {
  return {
    id,
    directionId: 'D1',
    title: `Variant ${id}`,
    width: 1080,
    height: 1080,
    sizeLabel: '1:1',
    language: 'en',
    format: 'image',
    durationMs: 6000,
    durationOverridden: false,
    rev: 1,
    createdBy: 'user',
    createdAt: '2026-11-21T00:00:00.000Z',
    agentChangedAt: null,
    isMaster: false,
    subjectIds: ['citrus-can'],
    badges: NO_BADGES,
    ...over,
  }
}

export function campaignGet(variants: VariantSummary[]): CampaignGet {
  return {
    campaign: {
      id: 'C1',
      name: 'Summer Splash',
      region: 'US',
      audience: 'Adults 21 to 35',
      message: '<b>Cool</b> down',
      offer: null,
      callToAction: null,
      tone: null,
      primaryLanguage: 'en',
      languages: ['en', 'de'],
      sizes: [],
      templateId: 'starter',
      brief: {} as CampaignGet['campaign']['brief'],
      createdBy: 'user',
      createdAt: '2026-11-21T00:00:00.000Z',
    },
    subjects: [{ id: 'citrus-can', name: 'Citrus can', description: 'A slim can', createdAt: '' }],
    ruleSet: {} as CampaignGet['ruleSet'],
    directions: [],
    variants,
    marks: { jobRunning: false, resultUnseen: false },
  }
}

export const SLOTS: TemplateSlots = [
  { slot: { id: 'headline', type: 'copy' }, state: 'empty', candidates: [] },
  { slot: { id: 'subject-image', type: 'image' }, state: 'empty', candidates: [] },
  { slot: { id: 'logo', type: 'image' }, state: 'empty', candidates: [] },
]

export const MASTER = variant('V1', { title: 'Master post', isMaster: true })
export const SECOND = variant('V2', { title: 'German post', language: 'de' })

export const LOCAL: ProviderInfo = {
  id: 'fake',
  label: 'Stand-in',
  jobs: ['image'],
  available: true,
  secrets: [],
  defaultModels: {},
  local: true,
  cancel: 'stops',
  serverText: false,
}

export function campaignApi(opts: { jobs?: JobRow[]; state?: Partial<AppState> } = {}) {
  const fake = makeFakeApi(baseState({ openProjects: [], ...opts.state }))
  fake.onQuery('campaign.get', () => ({ ok: true, data: campaignGet([MASTER, SECOND]) }))
  fake.onQuery('template.slots', () => ({ ok: true, data: SLOTS }))
  fake.onQuery('job.list', () => ({ ok: true, data: opts.jobs ?? [] }))
  return fake
}

export function sent(fake: ReturnType<typeof makeFakeApi>, name: string) {
  return fake.commands.filter((c) => c.name === name)
}

export function renderWith(ui: ReactElement, fake = campaignApi()) {
  return renderApp(ui, fake)
}
