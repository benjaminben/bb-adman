import { z } from 'zod'
import { projectScoped } from './project-scoped'

// SPEC 4.2 asset commands. Slice A adds its own schemas to this file around this one.

// asset.addGenerated [1.8]: a system command sent only by the job runner. It holds asset
// IDs and file extensions; no path and no file contents.
export const assetAddGeneratedInput = projectScoped.extend({
  jobId: z.string().min(1),
  files: z
    .array(z.object({ assetId: z.string().min(1), ext: z.string().regex(/^[a-z0-9]{1,10}$/) }))
    .min(1),
})
export type AssetAddGeneratedInput = z.infer<typeof assetAddGeneratedInput>
