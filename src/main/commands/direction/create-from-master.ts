// direction.createFromMaster (spec/links-and-sync.md, "Directions"; FR-074, A-139): a new
// direction from a master, its copy as the new master. Agent policy allow (D-105). Stakeholder change:
// no undo, like campaign.create; an unwanted direction is deleted.
import { ulid } from 'ulid'
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { newVariantId } from '@/main/commands/campaign/ids'
import * as schema from '@/main/db/schema'
import { readSnapshot, writeSnapshot } from '@/main/links/snapshot'
import {
  directionCreateFromMasterInput,
  type DirectionCreateReply,
} from '@/shared/schemas/commands/direction'
import type { VariantSnapshot } from '@/shared/schemas/links'
import { AppError } from '@/shared/schemas/result'
import { refuseTakenName } from './rename'

type Master = { campaignId: string; masterId: string }

export function directionCreateFromMaster(deps: CoreDeps) {
  return defineCommand({
    name: 'direction.createFromMaster',
    input: directionCreateFromMasterInput,
    projectId: (input) => input.projectId,
    run(ctx, input): HandlerResult<DirectionCreateReply> {
      const { db, orm } = ctx.project
      const row = db
        .prepare(
          `SELECT d.campaign_id AS campaignId, d.master_variant_id AS masterId
           FROM variant v JOIN direction d ON d.id = v.direction_id WHERE v.id = ?`,
        )
        .get(input.masterVariantId) as Master | undefined
      if (!row) throw new AppError('NOT_FOUND', 'That variant was not found.')
      if (row.masterId !== input.masterVariantId) {
        throw new AppError('RULE_VIOLATION', 'Only a master can start a new direction.', {
          reason: 'not_a_master',
        })
      }
      refuseTakenName(db, row.campaignId, input.name)
      const from = readSnapshot(db, row.masterId)
      if (!from) throw new AppError('NOT_FOUND', 'That variant was not found.')
      const { top } = db
        .prepare('SELECT MAX(sort) AS top FROM direction WHERE campaign_id = ?')
        .get(row.campaignId) as { top: number | null }
      const directionId = ulid()
      const variantId = newVariantId(db)
      orm
        .insert(schema.direction)
        .values({
          id: directionId,
          campaignId: row.campaignId,
          name: input.name,
          masterVariantId: variantId,
          sort: (top ?? -1) + 1,
        })
        .run()
      ctx.changes.touch('direction', { id: directionId })
      const copy: VariantSnapshot = {
        variant: {
          ...from.variant,
          id: variantId,
          directionId,
          rev: 0,
          createdBy: ctx.actor === 'agent' ? 'agent' : 'user',
          createdAt: deps.now().toISOString(),
          agentChangedAt: null,
        },
        subjectIds: from.subjectIds,
        layers: from.layers.map((l) => ({
          ...l,
          id: ulid(),
          variantId,
          linked: false,
          overrides: [],
        })),
        clips: from.clips.map((c) => ({ ...c, id: ulid(), variantId })),
      }
      writeSnapshot(ctx, copy)
      return {
        data: { directionId, variantId },
        log: { campaignId: row.campaignId, variantId },
      }
    },
  })
}
