// spec/editor-commands.md, "variant.update": the title only in Phase 3. Phase 7 adds
// durationMs; until then the strict schema refuses it.
import { z } from 'zod'
import { projectScoped } from './project-scoped'

export const variantUpdateInput = projectScoped
  .extend({ variantId: z.string().min(1), title: z.string().trim().min(1).max(200) })
  .strict()
export type VariantUpdateInput = z.infer<typeof variantUpdateInput>

export type VariantReply = { variantId: string }
