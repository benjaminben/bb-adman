// Answers for the project page tests (SPEC 14 1.41 TP-1): a project.get reply and a
// brief.parse reply shaped as slice C returns them.
import type { CampaignSummary, ProjectGet } from '@/shared/schemas/queries/campaign'
import type { BriefDraft } from '@/shared/schemas/brief'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import { baseState, makeFakeApi } from '../../fake-api'

export const PROJECT = { projectId: 'P1', name: 'Summer', filePath: '/w/Summer.adman' }

export function campaign(id: string, name: string): CampaignSummary {
  return {
    id,
    name,
    region: 'US',
    primaryLanguage: 'en',
    createdBy: 'user',
    createdAt: '2026-11-20T00:00:00.000Z',
    jobRunning: false,
    resultUnseen: false,
    variantCount: 0,
  }
}

export function subject(id: string, name: string): SubjectRow {
  return { id, name, description: '', createdAt: '2026-11-20T00:00:00.000Z' }
}

export function projectGet(
  campaigns: CampaignSummary[] = [],
  subjects: SubjectRow[] = [],
): ProjectGet {
  return {
    meta: {
      projectId: PROJECT.projectId,
      name: PROJECT.name,
      schemaVersion: 1,
      createdAppVersion: '0.1.0',
      createdAt: '2026-11-20T00:00:00.000Z',
    },
    subjects,
    campaigns,
    missingAssetCount: 0,
  }
}

export const DRAFT: BriefDraft = {
  campaignName: 'Summer Splash',
  region: 'US',
  audience: 'Adults 21 to 35',
  message: '<b>Cool</b> down with every sip',
  subjects: [
    { id: 'citrus-can', name: 'Citrus can', description: 'A slim can' },
    { id: 'berry-bottle', name: 'Berry bottle' },
  ],
  languages: ['en', 'de'],
  sizes: ['1:1', '9:16'],
}

// A fake api whose project.get answers with the given reply, and whose picker and
// brief.parse answer with a path and the draft above.
export function projectApi(reply: ProjectGet = projectGet(), draft: BriefDraft = DRAFT) {
  const fake = makeFakeApi(baseState({ openProjects: [PROJECT] }))
  fake.onQuery('project.get', () => ({ ok: true, data: reply }))
  fake.onQuery('dialog.pickFiles', () => ({ ok: true, data: { paths: ['/b/brief.yaml'] } }))
  fake.onCommand('brief.parse', () => ({
    ok: true,
    data: { draft, primaryLanguage: draft.languages?.[0] ?? 'en' },
  }))
  return fake
}
