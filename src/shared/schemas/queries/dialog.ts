import { z } from 'zod'

// SPEC 4.3 native pickers. Unknown keys are refused, so a picker never checks by hand.
export const pickFolderInput = z
  .object({ title: z.string().optional(), defaultPath: z.string().optional() })
  .strict()
export type PickFolderInput = z.infer<typeof pickFolderInput>

export const pickProjectFileInput = z.object({ defaultPath: z.string().optional() }).strict()
export type PickProjectFileInput = z.infer<typeof pickProjectFileInput>

export type PickedPath = { path: string | null }
