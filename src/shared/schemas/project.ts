import { z } from 'zod'

// SPEC 3.3 project_meta, as read by the main process.
export const projectMetaSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  schemaVersion: z.number().int().nonnegative(),
  createdAppVersion: z.string(),
  assetsDirRel: z.string(),
  assetsDirAbs: z.string(),
  createdAt: z.string(),
})
export type ProjectMeta = z.infer<typeof projectMetaSchema>

export const PROJECT_EXTENSION = '.adman'

export type OpenProjectSummary = { projectId: string; name: string; filePath: string }
