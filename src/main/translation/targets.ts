// What a translation job is for (spec/phases/phase-06.md, design addition 2,
// "translation.propose", steps 2 to 4; A-154, A-156): the groups of posts by direction and
// language, and per group the master's texts and the layers they may replace. Reads only, and
// only from the open project's own file, so every post and layer named is in this project.
import type Database from 'better-sqlite3'
import { readWireRow } from '@/main/db/rows'
import { masterOf } from '@/main/links/master-of'
import { MAX_TRANSLATION_ITEMS } from '@/shared/schemas/commands/translation'
import type { TranslationJobRequest } from '@/shared/schemas/jobs/translation'
import type { CampaignRow } from '@/shared/schemas/rows/campaign'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import type { LayerRow } from '@/shared/schemas/rows/layer'
import type { VariantRow } from '@/shared/schemas/rows/variant'
import { AppError } from '@/shared/schemas/result'

export type TranslationGroup = { directionId: string; language: string; variantIds: string[] }
export type TranslationPlan = { campaignId: string; request: TranslationJobRequest }
// translation.propose's input refuses anything but one of the two forms.
export type GroupsInput = { variantIds?: string[]; directionId?: string; language?: string }

const mainLanguage = () => new AppError('INVALID_INPUT', 'These posts are in the main language.')

function placeDirection(db: Database.Database, directionId: string) {
  const direction = readWireRow(db, 'direction', { id: directionId }) as DirectionRow | null
  const campaign = direction
    ? (readWireRow(db, 'campaign', { id: direction.campaignId }) as CampaignRow | null)
    : null
  return direction && campaign ? { direction, campaign } : null
}

function groupsOfPosts(db: Database.Database, variantIds: string[]): TranslationGroup[] {
  const groups = new Map<string, TranslationGroup>()
  for (const id of variantIds) {
    const variant = readWireRow(db, 'variant', { id }) as VariantRow | null
    const placed = variant ? placeDirection(db, variant.directionId) : null
    if (!variant || !placed) throw new AppError('NOT_FOUND', 'That post was not found.')
    if (variant.language === placed.campaign.primaryLanguage) throw mainLanguage()
    const key = JSON.stringify([variant.directionId, variant.language])
    const group = groups.get(key) ?? {
      directionId: variant.directionId,
      language: variant.language,
      variantIds: [],
    }
    if (!group.variantIds.includes(id)) group.variantIds.push(id)
    groups.set(key, group)
  }
  return [...groups.values()]
}

// Step 2: the named posts grouped by direction and language, or every post of one direction in
// one language. Refuses a post or direction not in this project and the primary language.
export function groupsFor(db: Database.Database, input: GroupsInput): TranslationGroup[] {
  if (input.variantIds !== undefined) return groupsOfPosts(db, input.variantIds)
  const { directionId = '', language = '' } = input
  const placed = placeDirection(db, directionId)
  if (!placed) throw new AppError('NOT_FOUND', 'That direction was not found.')
  if (language === placed.campaign.primaryLanguage) throw mainLanguage()
  const rows = db
    .prepare('SELECT id FROM variant WHERE direction_id = ? AND language = ? ORDER BY id')
    .all(directionId, language) as Array<{ id: string }>
  return [{ directionId, language, variantIds: rows.map((r) => r.id) }]
}

function textLayersOf(db: Database.Database, variantId: string): LayerRow[] {
  const rows = db
    .prepare(`SELECT id FROM layer WHERE variant_id = ? AND type = 'text' ORDER BY z, id`)
    .all(variantId) as Array<{ id: string }>
  return rows
    .map(({ id }) => readWireRow(db, 'layer', { id }) as LayerRow | null)
    .filter((l): l is LayerRow => l !== null)
}

// Step 4: a layer an AI text may replace. An approved one never is (A-156).
const isTarget = (layer: LayerRow, keys: Set<string>) =>
  keys.has(layer.key) &&
  (layer.translationStatus === 'missing' || layer.translationStatus === 'proposed') &&
  !layer.overrides.includes('copy')

// Steps 3 and 4 for one group: null when the master has no text, or, in 'write' mode, when no
// layer may be replaced. At most MAX_TRANSLATION_ITEMS texts, in the master's layer order.
export function planGroup(
  db: Database.Database,
  group: TranslationGroup,
  mode: TranslationJobRequest['mode'],
): TranslationPlan | null {
  const placed = placeDirection(db, group.directionId)
  const master = masterOf(db, group.directionId)
  if (!placed || !master) return null
  const items = master.layers
    .filter((l) => l.type === 'text' && (l.copy ?? '').trim() !== '')
    .slice(0, MAX_TRANSLATION_ITEMS)
    .map((l) => ({ key: l.key, text: l.copy ?? '', masterCopyRev: l.revs.copy }))
  if (items.length === 0) return null
  const keys = new Set(items.map((i) => i.key))
  const targets =
    mode === 'sync'
      ? []
      : group.variantIds
          .flatMap((id) => textLayersOf(db, id))
          .filter((l) => isTarget(l, keys))
          .map((l) => ({ layerId: l.id, key: l.key, copyRev: l.revs.copy }))
  if (mode === 'write' && targets.length === 0) return null
  const { campaign } = placed
  const request: TranslationJobRequest = {
    mode,
    directionId: group.directionId,
    from: campaign.primaryLanguage,
    to: group.language,
    region: campaign.brief.region,
    audience: campaign.brief.audience,
    items,
    targets,
  }
  return { campaignId: campaign.id, request }
}
