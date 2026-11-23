// direction.rename (spec/links-and-sync.md, "Directions"; A-139): a new name, unique in the
// campaign ignoring case; the direction's own name counts as free. Agent policy allow (D-105). Inverse
// direction.rename with the old name, on the campaign's list.
import type Database from 'better-sqlite3'
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { readWireRow } from '@/main/db/rows'
import { directionRenameInput, type DirectionReply } from '@/shared/schemas/commands/direction'
import type { DirectionRow } from '@/shared/schemas/rows/direction'
import { AppError } from '@/shared/schemas/result'

const key = (name: string) => name.trim().toLowerCase()

// Refuses a name another direction of the campaign holds, ignoring case and outer spaces.
export function refuseTakenName(
  db: Database.Database,
  campaignId: string,
  name: string,
  ownId: string | null = null,
): void {
  const rows = db
    .prepare('SELECT id, name FROM direction WHERE campaign_id = ?')
    .all(campaignId) as Array<{ id: string; name: string }>
  if (rows.some((r) => r.id !== ownId && key(r.name) === key(name))) {
    throw new AppError('RULE_VIOLATION', 'This campaign already has a direction with that name.', {
      reason: 'direction_name_taken',
    })
  }
}

export function readDirection(db: Database.Database, id: string): DirectionRow {
  const row = readWireRow(db, 'direction', { id }) as DirectionRow | null
  if (!row) throw new AppError('NOT_FOUND', 'That direction was not found.')
  return row
}

export function directionRename(_deps: CoreDeps) {
  return defineCommand({
    name: 'direction.rename',
    input: directionRenameInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<DirectionReply> {
      const db = ctx.project.db
      const direction = readDirection(db, input.directionId)
      refuseTakenName(db, direction.campaignId, input.name, direction.id)
      db.prepare('UPDATE direction SET name = ? WHERE id = ?').run(input.name, direction.id)
      ctx.changes.touch('direction', { id: direction.id })
      const call = {
        name: 'direction.rename',
        input: { projectId: input.projectId, directionId: direction.id, name: direction.name },
      }
      return {
        data: { directionId: direction.id },
        log: { campaignId: direction.campaignId },
        inverse: { scope: `campaign:${direction.campaignId}`, call },
      }
    },
  })
}
