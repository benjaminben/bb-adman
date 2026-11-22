// publish.inspect (spec/phases/phase-09.md "Publishing"). User only: the answer holds full
// local paths (A-218).
import { z } from 'zod'
import { projectScoped } from '@/shared/schemas/commands/project-scoped'
import { publishStorageId, type PublishStorageId } from '@/shared/schemas/commands/publish'

// `storage` null asks for the storages and components only, with `existing` null.
export const publishInspectInput = projectScoped
  .extend({ campaignId: z.string().min(1).max(200), storage: publishStorageId.nullable() })
  .strict()
export type PublishInspectInput = z.infer<typeof publishInspectInput>

export type PublishReady = 'ready' | 'not_set_up' | 'needs_key' | 'not_signed_in'

export type PublishComponentFolder = 'backgrounds' | 'logos' | 'subjects' | 'images' | 'fonts'

export type PublishComponent = {
  assetId: string
  displayName: string
  kind: 'image' | 'video' | 'font'
  folder: PublishComponentFolder
  localPath: string
  problem: 'missing' | 'wrong_type' | null
  // Fonts only; null for every other kind.
  shareAllowed: boolean | null
}

export type PublishInspect = {
  // `fake` only when the fake provider is listed.
  storages: Array<{ id: PublishStorageId; label: string; ready: PublishReady }>
  existing: null | {
    files: number
    publishNumber: number | null
    publishedAt: string | null
    otherProject: boolean
  }
  components: PublishComponent[]
}
