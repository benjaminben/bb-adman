// spec/links-and-sync.md, "Sync": sync.preview, what syncing a direction would change. Both
// actors may read it.
import { z } from 'zod'
import { projectScoped } from '@/shared/schemas/commands/project-scoped'
import type { LayerValues } from '@/shared/schemas/links'

export const syncPreviewInput = projectScoped.extend({ directionId: z.string().min(1) }).strict()
export type SyncPreviewInput = z.infer<typeof syncPreviewInput>

export type SyncGroup = 'copy' | 'style' | 'geometry' | 'source' | 'timing' | 'animation'

export type SyncChange = {
  layerKey: string
  layerName: string // the master's layer name (add-layer, update) or the variant's (remove-layer)
  kind: 'update' | 'add-layer' | 'remove-layer'
  groups: SyncGroup[]
  proposed: Partial<LayerValues> // the values after the sync, override paths left as they are
  proposedTranslation?: { text: string; status: 'proposed' | 'failed' }
  blockedByOverride: string[] // override paths the change would write
}

export type SyncPreview = { variantId: string; changes: SyncChange[] }

export type SyncPreviewReply = {
  directionId: string
  masterVariantId: string
  masterRev: number // the master's variant.rev the preview was made from
  variants: SyncPreview[] // only out-of-date variants, in campaign.get order
}
