// SPEC 6.1 starter template: what fills each slot of a new master variant. Reads asset rows
// by ID only and never builds a path (SPEC 14, contracts A and C).
import type Database from 'better-sqlite3'
import type { Brief } from '@/shared/schemas/brief'
import type { RuleSetValues } from '@/shared/schemas/commands/campaign'
import type { SlotFills, Template } from '@/shared/templates/types'

// A hero image is an image in the asset library attached to a subject; with several, the
// newest fills the slot (SPEC 3.3 asset rules, R-12). The first subject with one is used.
function heroImage(db: Database.Database, subjectIds: string[]): string | null {
  const find = db.prepare(
    `SELECT id FROM asset WHERE subject_id = ? AND library = 'asset' AND kind = 'image'
     ORDER BY created_at DESC, id DESC LIMIT 1`,
  )
  for (const subjectId of subjectIds) {
    const row = find.get(subjectId) as { id: string } | undefined
    if (row) return row.id
  }
  return null
}

// The first image among the rule set's required assets (SPEC 6.1, logo slot).
function logoImage(db: Database.Database, requiredAssetIds: string[]): string | null {
  const kind = db.prepare('SELECT kind FROM asset WHERE id = ?')
  for (const id of requiredAssetIds) {
    const row = kind.get(id) as { kind: string } | undefined
    if (row?.kind === 'image') return id
  }
  return null
}

// Fills are built from the template's own slots, so buildMasterLayers never meets a slot it
// does not have (SPEC 14 [1.9]). The background stays empty until generated or chosen.
export function slotFills(
  db: Database.Database,
  template: Template,
  brief: Brief,
  subjectIds: string[],
  ruleSet: RuleSetValues,
): SlotFills {
  const values: Record<string, SlotFills[string]> = {}
  const hero = heroImage(db, subjectIds)
  const logo = logoImage(db, ruleSet.requiredAssetIds)
  if (hero) values['subject-image'] = { assetId: hero }
  if (logo) values.logo = { assetId: logo }
  values.headline = { text: brief.message }
  if (brief.callToAction !== undefined && brief.callToAction.trim() !== '') {
    values['call-to-action'] = { text: brief.callToAction }
  }
  const fills: SlotFills = {}
  for (const slot of template.slots) {
    const fill = values[slot.id]
    if (fill) fills[slot.id] = fill
  }
  return fills
}
