import { z } from 'zod'

// SPEC 4.3 native pickers. Unknown keys are refused, so a picker never checks by hand.
export const pickFolderInput = z
  .object({ title: z.string().optional(), defaultPath: z.string().optional() })
  .strict()
export type PickFolderInput = z.infer<typeof pickFolderInput>

export const pickProjectFileInput = z.object({ defaultPath: z.string().optional() }).strict()
export type PickProjectFileInput = z.infer<typeof pickProjectFileInput>

export type PickedPath = { path: string | null }

// SPEC 4.3 dialog.pickFiles (Phase 2 slice A). The types offered come from file-types.ts by
// purpose and kind; multiple defaults to true for import and false otherwise.
export const pickFilesInput = z
  .object({
    purpose: z.enum(['import', 'relink', 'brief']),
    kind: z.enum(['image', 'video', 'font', 'text', 'audio']).optional(),
    multiple: z.boolean().optional(),
    defaultPath: z.string().optional(),
  })
  .strict()
export type PickFilesInput = z.infer<typeof pickFilesInput>

export type PickedPaths = { paths: string[] }

// Phase 6 section 1 dialog.pickSaveFile (P6-8). defaultPath is only shown in the dialog; the
// command that writes the file checks the path the user chose.
export const pickSaveFileInput = z
  .object({ purpose: z.enum(['translation-sheet']), defaultPath: z.string().optional() })
  .strict()
export type PickSaveFileInput = z.infer<typeof pickSaveFileInput>
