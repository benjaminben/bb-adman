import { z } from 'zod'
import { projectScoped } from './project-scoped'

// asset.importFiles (spec/phases/round-2-platform.md, D5): an agent's import of files by their
// full paths, through the ask. The path text rules (full path, no hidden characters, a picture,
// video or font extension) are the command's, so each refusal can name the file by its place.
export const assetImportFilesInput = projectScoped
  .extend({
    paths: z.array(z.string()).min(1).max(20),
    library: z.enum(['asset', 'reference']).default('asset'),
  })
  .strict()
export type AssetImportFilesInput = z.infer<typeof assetImportFilesInput>
