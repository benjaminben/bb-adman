// spec/links-and-sync.md, "Directions": the four direction commands. Every input is strict.
import { z } from 'zod'
import { DirectionRow } from '@/shared/schemas/rows/direction'
import { VariantSnapshot, directionName } from '@/shared/schemas/links'
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

// System command: only the inverse of direction.delete. A direction holds at least its
// master, and has no upper count, so the delete's snapshot always fits.
export const directionRestoreInput = projectScoped
  .extend({ direction: DirectionRow.strict(), variants: z.array(VariantSnapshot).min(1) })
  .strict()
export type DirectionRestoreInput = z.infer<typeof directionRestoreInput>

// Replies.
export type DirectionCreateReply = { directionId: string; variantId: string }
export type DirectionReply = { directionId: string }
