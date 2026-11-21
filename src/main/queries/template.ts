// The template query domain (SPEC 12, 4.3; SPEC 14, slice C). template.list gives the
// templates of this build; template.slots gives each slot of a campaign's master variant as
// filled or empty, with the asset IDs that could fill it [FR-042].
import type Database from 'better-sqlite3'
import type { CoreDeps } from '@/main/core-deps'
import type { QueryFn } from './types'
import { readWireRow, readWireRows } from '@/main/db/rows'
import { directionsOf, openFor, requireCampaign } from './campaign-reads'
import { slotStates, starterTemplate } from '@/shared/templates/starter'
import {
  campaignScopedInput,
  templateListInput,
  type TemplateList,
  type TemplateSlots,
} from '@/shared/schemas/queries/campaign'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { RuleSetRow } from '@/shared/schemas/rows/rule-set'

const TEMPLATES = [starterTemplate]

// Hero images of the campaign's subjects, newest first (SPEC 3.3 asset rules, R-12), and the
// images among the rule set's required assets (SPEC 6.1, logo slot).
function candidatesFor(db: Database.Database, campaignId: string): Record<string, string[]> {
  const heroes = db
    .prepare(
      `SELECT a.id FROM asset a JOIN campaign_subject cs ON cs.subject_id = a.subject_id
       WHERE cs.campaign_id = ? AND a.library = 'asset' AND a.kind = 'image'
       ORDER BY a.created_at DESC, a.id DESC`,
    )
    .all(campaignId) as Array<{ id: string }>
  const rules = readWireRow(db, 'rule_set', { campaignId }) as RuleSetRow | null
  const isImage = db.prepare("SELECT 1 FROM asset WHERE id = ? AND kind = 'image'")
  const logos = (rules?.requiredAssetIds ?? []).filter((id) => isImage.get(id) !== undefined)
  return { 'subject-image': heroes.map((h) => h.id), logo: logos }
}

export function templateList(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return (raw): TemplateList => {
    openFor(deps, templateListInput, raw)
    return TEMPLATES.map((t) => ({ ...t, slots: t.slots.map((s) => ({ ...s })) }))
  }
}

export function templateSlots(deps: Pick<CoreDeps, 'projects'>): QueryFn {
  return (raw): TemplateSlots => {
    const { input, project } = openFor(deps, campaignScopedInput, raw)
    const campaign = requireCampaign(project.db, input.campaignId)
    const template = TEMPLATES.find((t) => t.id === campaign.templateId) ?? starterTemplate
    const masterId = directionsOf(project.db, campaign.id)[0]?.masterVariantId
    const layers = (readWireRows(project.db, 'layer') as LayerRow[]).filter(
      (l) => l.variantId === masterId,
    )
    return slotStates(template, layers, candidatesFor(project.db, campaign.id))
  }
}

export function templateQueries(deps: CoreDeps): Record<string, QueryFn> {
  return { 'template.list': templateList(deps), 'template.slots': templateSlots(deps) }
}
