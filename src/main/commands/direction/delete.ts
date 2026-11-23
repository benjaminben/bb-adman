// direction.delete (spec/links-and-sync.md, "Directions"; A-140): deletes a direction and its
// variants. Agent policy ask (D-105). Stakeholder change: no undo (the screen warns first). It clears
// the campaign's list, whose older entries may name the removed variants, and each removed
// variant's own list; every ID comes from the file, not the input.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import type { UndoScope } from '@/main/history/undo-lists'
import { deleteVariants } from '@/main/links/snapshot'
import { directionDeleteInput, type DirectionReply } from '@/shared/schemas/commands/direction'
import { AppError } from '@/shared/schemas/result'
import { readDirection } from './rename'

export function directionDelete(_deps: CoreDeps) {
  return defineCommand({
    name: 'direction.delete',
    input: directionDeleteInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<DirectionReply> {
      const db = ctx.project.db
      const direction = readDirection(db, input.directionId)
      const { n } = db
        .prepare('SELECT COUNT(*) AS n FROM direction WHERE campaign_id = ?')
        .get(direction.campaignId) as { n: number }
      if (n <= 1) {
        throw new AppError('RULE_VIOLATION', 'A campaign keeps at least one direction.', {
          reason: 'last_direction',
        })
      }
      const variantIds = (
        db
          .prepare('SELECT id FROM variant WHERE direction_id = ? ORDER BY id')
          .all(direction.id) as Array<{ id: string }>
      ).map((r) => r.id)
      const running = db
        .prepare(
          `SELECT 1 FROM job WHERE status IN ('queued','running')
           AND variant_id IN (SELECT id FROM variant WHERE direction_id = ?)`,
        )
        .get(direction.id)
      if (running) {
        throw new AppError(
          'RULE_VIOLATION',
          'Work is still running for this direction. Stop it, or wait for it to finish.',
          { reason: 'jobs_running' },
        )
      }
      deleteVariants(ctx, variantIds)
      db.prepare('DELETE FROM direction WHERE id = ?').run(direction.id)
      ctx.changes.touch('direction', { id: direction.id })
      const clearScopes: UndoScope[] = [
        `campaign:${direction.campaignId}`,
        ...variantIds.map((id): UndoScope => `variant:${id}`),
      ]
      return {
        data: { directionId: direction.id },
        log: { campaignId: direction.campaignId },
        clearScopes,
      }
    },
  })
}
