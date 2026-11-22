// campaign.update (SPEC 4.2; FR-031, FR-032). Undoable on the campaign's list: the inverse is
// the same command with the values the fields had before. The stored brief is the confirmed
// brief and is not rewritten. [1.42] languages and sizes change the two lists and nothing
// else: no variant is added, removed or changed.
import type Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import { defineCommand } from '@/main/commands/types'
import { campaign } from '@/main/db/schema'
import { readWireRow, storedJson } from '@/main/db/rows'
import { campaignNotFound } from './rule-set-values'
import { refuseRightToLeft } from './create'
import { AppError } from '@/shared/schemas/result'
import { labelFitsPixels } from '@/shared/brief/size'
import { LABEL_MISFIT } from '@/shared/schemas/commands/campaign'
import {
  campaignUpdateInput,
  type CampaignUpdateInput,
} from '@/shared/schemas/commands/campaign-edit'
import type { CampaignRow } from '@/shared/schemas/rows/campaign'

const FIELDS = ['name', 'audience', 'tone', 'offer', 'callToAction', 'languages', 'sizes'] as const
type Patch = Partial<Pick<CampaignRow, (typeof FIELDS)[number]>>

type MasterSize = { sizeLabel: string; width: number; height: number }

// SPEC 4.2 [1.42]: the primary language stays on the list, and every direction's master keeps
// its size. Neither refusal carries a reason.
function checkLists(db: Database.Database, row: CampaignRow, input: CampaignUpdateInput): void {
  if (input.languages) {
    refuseRightToLeft(input.languages)
    if (!input.languages.includes(row.primaryLanguage)) {
      throw new AppError('RULE_VIOLATION', "The campaign's first language cannot be removed.")
    }
  }
  if (input.sizes) {
    const sizes = input.sizes
    const masters = db
      .prepare<[string], MasterSize>(
        `SELECT v.size_label AS sizeLabel, v.width, v.height FROM variant v
         JOIN direction d ON d.master_variant_id = v.id WHERE d.campaign_id = ?`,
      )
      .all(row.id)
    const kept = (m: MasterSize) =>
      sizes.some((s) => s.label === m.sizeLabel && s.width === m.width && s.height === m.height)
    if (!masters.every(kept)) {
      throw new AppError('RULE_VIOLATION', 'The size of the master cannot be removed or changed.')
    }
    // LP-4: after the master rule, so a master's label with other pixels stays RULE_VIOLATION.
    if (!sizes.every(labelFitsPixels)) throw new AppError('INVALID_INPUT', LABEL_MISFIT)
  }
}

function stored(patch: Patch) {
  const { languages, sizes, ...text } = patch
  return {
    ...text,
    ...(languages ? { languages: storedJson('campaign', 'languages', languages) ?? '' } : {}),
    ...(sizes ? { sizes: storedJson('campaign', 'sizes', sizes) ?? '' } : {}),
  }
}

export function campaignUpdate() {
  return defineCommand({
    name: 'campaign.update',
    input: campaignUpdateInput,
    projectId: (input) => input.projectId,
    run(ctx, input) {
      const row = readWireRow(ctx.project.db, 'campaign', {
        id: input.campaignId,
      }) as CampaignRow | null
      if (!row) throw campaignNotFound()
      checkLists(ctx.project.db, row, input)
      const given = FIELDS.filter((field) => input[field] !== undefined)
      const pick = (from: Patch) =>
        Object.fromEntries(given.map((field) => [field, from[field]])) as Patch
      const patch = pick(input)
      const before = pick(row)
      if (Object.keys(patch).length > 0) {
        const values = stored(patch)
        ctx.project.orm.update(campaign).set(values).where(eq(campaign.id, input.campaignId)).run()
        ctx.changes.touch('campaign', { id: input.campaignId })
      }
      const call = {
        name: 'campaign.update',
        input: { projectId: input.projectId, campaignId: input.campaignId, ...before },
      }
      return {
        data: { campaignId: input.campaignId },
        inverse: { scope: `campaign:${input.campaignId}`, call },
        log: { campaignId: input.campaignId },
      }
    },
  })
}
