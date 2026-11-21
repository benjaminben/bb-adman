// spec/links-and-sync.md, "Directions": the three direction commands. Every input is strict.
import { z } from 'zod'
import { directionName } from '@/shared/schemas/links'
import { projectScoped } from './project-scoped'

export const directionCreateFromMasterInput = projectScoped
  .extend({ masterVariantId: z.string().min(1), name: directionName })
  .strict()
export type DirectionCreateFromMasterInput = z.infer<typeof directionCreateFromMasterInput>

export const directionRenameInput = projectScoped
  .extend({ directionId: z.string().min(1), name: directionName })
  .strict()
export type DirectionRenameInput = z.infer<typeof directionRenameInput>

export const directionDeleteInput = projectScoped
  .extend({ directionId: z.string().min(1) })
  .strict()
export type DirectionDeleteInput = z.infer<typeof directionDeleteInput>

// Replies.
export type DirectionCreateReply = { directionId: string; variantId: string }
export type DirectionReply = { directionId: string }
