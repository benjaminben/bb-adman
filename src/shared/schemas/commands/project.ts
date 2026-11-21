import { z } from 'zod'
import { PROJECT_EXTENSION } from '../project'
import { projectName } from '../project-name'

export { projectName }

export const projectCreateInput = z.object({ name: projectName, location: z.string().min(1) })

export const projectOpenInput = z.object({
  filePath: z
    .string()
    .min(1)
    .refine(
      (p) => p.toLowerCase().endsWith(PROJECT_EXTENSION),
      'Choose an Adman project file (.adman).',
    ),
})

// runningJobs [1.8]: 'refuse' (the default) refuses while a job is queued or running;
// 'stop' cancels those jobs first (SPEC 3.6, "Jobs").
export const projectCloseInput = z.object({
  projectId: z.string().min(1),
  runningJobs: z.enum(['refuse', 'stop']).default('refuse'),
})
