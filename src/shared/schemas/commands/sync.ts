// spec/links-and-sync.md, "Sync": sync.apply takes choices only; the values come from the
// database (A-137).
import { z } from 'zod'
import { MAX_SYNC_DECISIONS, SyncDecision } from '@/shared/schemas/links'
import { projectScoped } from './project-scoped'

export const syncApplyInput = projectScoped
  .extend({
    directionId: z.string().min(1),
    masterRev: z.number().int().min(0),
    decisions: z.array(SyncDecision).max(MAX_SYNC_DECISIONS),
  })
  .strict()
export type SyncApplyInput = z.infer<typeof syncApplyInput>

// The variants written.
export type SyncApplyReply = { variantIds: string[] }
