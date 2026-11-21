// spec/phases/phase-06.md, design addition 5, "Storing and reading": one variant's CheckInput,
// read from the given project file only. Every read is by key, with bound parameters.
import type Database from 'better-sqlite3'
import { readWireRow } from '@/main/db/rows'
import { readLayers } from '@/main/links/snapshot'
import { requireCampaign } from '@/main/queries/campaign-reads'
import { requireVariant } from '@/main/queries/variant-reads'
import type { CheckInput } from '@/shared/checks/types'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { RuleSetRow } from '@/shared/schemas/rows/rule-set'
import type { VariantRow } from '@/shared/schemas/rows/variant'

export type VariantCheckInput = { variant: VariantRow; input: CheckInput }

// The display names of the required assets. A name, never a path: the findings reach agents.
// An ID with no asset row has no name, and the engine then names it by its ID.
function assetNamesOf(db: Database.Database, assetIds: string[]): Record<string, string> {
  const names: Record<string, string> = {}
  for (const id of assetIds) {
    const asset = readWireRow(db, 'asset', { id }) as AssetRow | null
    if (asset) names[id] = asset.displayName
  }
  return names
}

// Throws NOT_FOUND when the variant is not in this project file.
export function readCheckInput(db: Database.Database, variantId: string): VariantCheckInput {
  const { variant, direction } = requireVariant(db, variantId)
  const campaign = requireCampaign(db, direction.campaignId)
  const rules = readWireRow(db, 'rule_set', { campaignId: campaign.id }) as RuleSetRow | null
  const ruleSet = {
    requiredAssetIds: rules?.requiredAssetIds ?? [],
    palette: rules?.palette ?? [],
    requiredWords: rules?.requiredWords ?? {},
    prohibitedWords: rules?.prohibitedWords ?? {},
  }
  return {
    variant,
    input: {
      variant: {
        format: variant.format,
        width: variant.width,
        height: variant.height,
        durationMs: variant.durationMs,
        language: variant.language,
      },
      primaryLanguage: campaign.primaryLanguage,
      layers: readLayers(db, variantId),
      ruleSet,
      assetNames: assetNamesOf(db, ruleSet.requiredAssetIds),
    },
  }
}

// The variants of a campaign of this project file, by direction order then ID. Throws
// NOT_FOUND when the campaign is not in it.
export function campaignVariantIds(db: Database.Database, campaignId: string): string[] {
  requireCampaign(db, campaignId)
  const rows = db
    .prepare(
      `SELECT v.id AS id FROM variant v JOIN direction d ON d.id = v.direction_id
       WHERE d.campaign_id = ? ORDER BY d.sort, v.id`,
    )
    .all(campaignId) as Array<{ id: string }>
  return rows.map((r) => r.id)
}

// The variant IDs a check.run or check.results input names.
export function targetVariantIds(
  db: Database.Database,
  target: { campaignId?: string; variantIds?: string[] },
): string[] {
  if (target.campaignId !== undefined) return campaignVariantIds(db, target.campaignId)
  return [...new Set(target.variantIds ?? [])]
}
