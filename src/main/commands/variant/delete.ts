// variant.delete (spec/links-and-sync.md, "Adding back and removing variants"; FR-073, FR-197,
// R-17): deletes one variant that is not a master. Agent policy ask. The inverse is
// variant.restore with the whole variant, on the campaign's list; the variant's own list is
// cleared (A-141). Refused while a job for it is queued or running (A-140).
import type Database from 'better-sqlite3'
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { deleteVariants, readSnapshot } from '@/main/links/snapshot'
import { variantDeleteInput, type VariantReply } from '@/shared/schemas/commands/variant'
import { AppError } from '@/shared/schemas/result'

// The campaign of a variant that may be removed. Refuses an unknown variant, a master and a
// variant with work still running. Reads only; the IDs it gives come from the file.
export function removableCampaign(db: Database.Database, variantId: string): string {
  const row = db
    .prepare(
      `SELECT d.campaign_id AS campaignId, d.master_variant_id AS masterId
       FROM variant v JOIN direction d ON d.id = v.direction_id WHERE v.id = ?`,
    )
    .get(variantId) as { campaignId: string; masterId: string } | undefined
  if (!row) throw new AppError('NOT_FOUND', 'That variant was not found.')
  if (row.masterId === variantId) {
    throw new AppError('RULE_VIOLATION', 'A master cannot be deleted while its direction exists.', {
      reason: 'master_variant',
    })
  }
  const running = db
    .prepare("SELECT 1 FROM job WHERE variant_id = ? AND status IN ('queued','running')")
    .get(variantId)
  if (running) {
    throw new AppError(
      'RULE_VIOLATION',
      'Work is still running for this variant. Stop it, or wait for it to finish.',
      { reason: 'jobs_running' },
    )
  }
  return row.campaignId
}

export function variantDelete(_deps: CoreDeps) {
  return defineCommand({
    name: 'variant.delete',
    input: variantDeleteInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<VariantReply> {
      const db = ctx.project.db
      const campaignId = removableCampaign(db, input.variantId)
      const snapshot = readSnapshot(db, input.variantId)
      if (!snapshot) throw new AppError('NOT_FOUND', 'That variant was not found.')
      const variantId = snapshot.variant.id
      deleteVariants(ctx, [variantId])
      const call = {
        name: 'variant.restore',
        input: { projectId: input.projectId, snapshots: [snapshot] },
      }
      return {
        data: { variantId },
        log: { campaignId, variantId },
        inverse: { scope: `campaign:${campaignId}`, call },
        clearScopes: [`variant:${variantId}`],
      }
    },
  })
}
