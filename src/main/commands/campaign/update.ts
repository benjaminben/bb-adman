// campaign.update (SPEC 4.2; FR-031). Undoable on the campaign's list: the inverse is the
// same command with the values the fields had before. The stored brief is the confirmed
// brief and is not rewritten.
import { eq } from 'drizzle-orm'
import { defineCommand } from '../types'
import { campaign } from '../../db/schema'
import { readWireRow } from '../../db/rows'
import { campaignNotFound } from './rule-set-values'
import { campaignUpdateInput } from '../../../shared/schemas/commands/campaign-edit'
import type { CampaignRow } from '../../../shared/schemas/rows/campaign'

const FIELDS = ['name', 'audience', 'tone', 'offer', 'callToAction'] as const
type Field = (typeof FIELDS)[number]
// name and audience are never null: the schema refuses it and a stored row has text.
type Patch = { name?: string; audience?: string } & Partial<
  Record<'tone' | 'offer' | 'callToAction', string | null>
>

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
      const given = FIELDS.filter((field) => input[field] !== undefined)
      const pick = (from: Partial<Record<Field, string | null>>) =>
        Object.fromEntries(given.map((field) => [field, from[field]])) as Patch
      const patch = pick(input)
      const before = pick(row)
      if (Object.keys(patch).length > 0) {
        ctx.project.orm.update(campaign).set(patch).where(eq(campaign.id, input.campaignId)).run()
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
