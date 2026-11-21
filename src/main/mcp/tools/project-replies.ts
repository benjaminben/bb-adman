// Allow-list pickers for get_project and get_campaign (MCP-D; spec/mcp-and-agents.md, notes
// on single tools). Each names today's fields, so a field added later to a campaign, variant,
// subject, rule set or direction row (a path, say) cannot leave through MCP (FR-198).
import type { Brief } from '@/shared/schemas/brief'
import type { CampaignSize } from '@/shared/schemas/commands/campaign'
import type {
  CampaignGet,
  CampaignSummary,
  JobMarks,
  ProjectGet,
  VariantSummary,
} from '@/shared/schemas/queries/campaign'
import type { CampaignRow } from '@/shared/schemas/rows/campaign'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import type { RuleSetRow } from '@/shared/schemas/rows/rule-set'
import type { SubjectRow } from '@/shared/schemas/rows/subject'
import type { ReplyPicker } from './read-replies'

type Words = string[] | Record<string, string[]>

// Word lists are data: language codes to lists of words.
const words = (w: Words): Words =>
  Array.isArray(w) ? [...w] : Object.fromEntries(Object.entries(w).map(([k, v]) => [k, [...v]]))

const subject = (s: SubjectRow) => ({
  id: s.id,
  name: s.name,
  description: s.description,
  createdAt: s.createdAt,
})

const marks = (m: JobMarks) => ({ jobRunning: m.jobRunning, resultUnseen: m.resultUnseen })

const summary = (c: CampaignSummary) => ({
  id: c.id,
  name: c.name,
  region: c.region,
  primaryLanguage: c.primaryLanguage,
  createdBy: c.createdBy,
  createdAt: c.createdAt,
  ...marks(c),
  variantCount: c.variantCount,
  cover: c.cover ? { variantId: c.cover.variantId, rev: c.cover.rev } : null,
})

export const projectFields: ReplyPicker = (data) => {
  const p = data as ProjectGet
  return {
    meta: {
      projectId: p.meta.projectId,
      name: p.meta.name,
      schemaVersion: p.meta.schemaVersion,
      createdAppVersion: p.meta.createdAppVersion,
      createdAt: p.meta.createdAt,
    },
    subjects: p.subjects.map(subject),
    campaigns: p.campaigns.map(summary),
    missingAssetCount: p.missingAssetCount,
  }
}

const brief = (b: Brief) => ({
  campaignName: b.campaignName,
  region: b.region,
  audience: b.audience,
  message: b.message,
  subjects: b.subjects.map((s) => ({ id: s.id, name: s.name, description: s.description })),
  offer: b.offer,
  callToAction: b.callToAction,
  tone: b.tone,
  requiredWords: b.requiredWords && words(b.requiredWords),
  prohibitedWords: b.prohibitedWords && words(b.prohibitedWords),
  languages: b.languages && [...b.languages],
  sizes: b.sizes && [...b.sizes],
  copy:
    b.copy &&
    Object.fromEntries(
      Object.entries(b.copy).map(([lang, c]) => [
        lang,
        { headline: c.headline, callToAction: c.callToAction },
      ]),
    ),
})

const size = (s: CampaignSize) => ({ label: s.label, width: s.width, height: s.height })

const campaign = (c: CampaignRow) => ({
  id: c.id,
  name: c.name,
  region: c.region,
  audience: c.audience,
  message: c.message,
  offer: c.offer,
  callToAction: c.callToAction,
  tone: c.tone,
  primaryLanguage: c.primaryLanguage,
  languages: [...c.languages],
  sizes: c.sizes.map(size),
  templateId: c.templateId,
  brief: brief(c.brief),
  createdBy: c.createdBy,
  createdAt: c.createdAt,
})

const ruleSet = (r: RuleSetRow) => ({
  campaignId: r.campaignId,
  requiredAssetIds: [...r.requiredAssetIds],
  palette: [...r.palette],
  requiredWords: words(r.requiredWords),
  prohibitedWords: words(r.prohibitedWords),
})

const direction = (d: DirectionRow) => ({
  id: d.id,
  campaignId: d.campaignId,
  name: d.name,
  masterVariantId: d.masterVariantId,
  sort: d.sort,
})

const variant = (v: VariantSummary) => ({
  id: v.id,
  directionId: v.directionId,
  title: v.title,
  width: v.width,
  height: v.height,
  sizeLabel: v.sizeLabel,
  language: v.language,
  format: v.format,
  durationMs: v.durationMs,
  durationOverridden: v.durationOverridden,
  rev: v.rev,
  createdBy: v.createdBy,
  createdAt: v.createdAt,
  agentChangedAt: v.agentChangedAt,
  isMaster: v.isMaster,
  subjectIds: [...v.subjectIds],
  badges: {
    ...marks(v.badges),
    outOfDate: v.badges.outOfDate,
    overflow: v.badges.overflow,
    translationUnapproved: v.badges.translationUnapproved,
    checkWarning: v.badges.checkWarning,
    checkStale: v.badges.checkStale,
    missingFile: v.badges.missingFile,
  },
})

export const campaignFields: ReplyPicker = (data) => {
  const c = data as CampaignGet
  return {
    campaign: campaign(c.campaign),
    subjects: c.subjects.map(subject),
    ruleSet: ruleSet(c.ruleSet),
    directions: c.directions.map(direction),
    variants: c.variants.map(variant),
    marks: marks(c.marks),
  }
}
