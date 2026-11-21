import { z } from 'zod'
import { storedProjectName } from './project-name'

// SPEC 3.3 project_meta, as read by the main process. The name comes from a file that may
// come from anyone, so readMeta refuses one the app could not have stored (SPEC 8.1 [1.30]).
export const projectMetaSchema = z.object({
  projectId: z.string(),
  name: storedProjectName,
  schemaVersion: z.number().int().nonnegative(),
  createdAppVersion: z.string(),
  assetsDirRel: z.string(),
  assetsDirAbs: z.string(),
  createdAt: z.string(),
})
export type ProjectMeta = z.infer<typeof projectMetaSchema>

export const PROJECT_EXTENSION = '.adman'

export type OpenProjectSummary = { projectId: string; name: string; filePath: string }
