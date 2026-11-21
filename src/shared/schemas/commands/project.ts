import { z } from 'zod'
import { isReserved } from '../../config/reserved-names'
import { PROJECT_EXTENSION } from '../project'

// A project name becomes a file name, so it must be safe on macOS and Windows.
const FORBIDDEN = /[/\\:*?"<>|]/
const hasControlChar = (n: string) => [...n].some((c) => c.charCodeAt(0) < 0x20)

export const projectName = z
  .string()
  .trim()
  .min(1, 'Enter a name.')
  .max(100, 'Use 100 characters or fewer.')
  .refine((n) => !FORBIDDEN.test(n), 'Names cannot contain / \\ : * ? " < > |')
  .refine((n) => !hasControlChar(n), 'Names cannot contain control characters.')
  .refine((n) => !n.startsWith('.') && !n.endsWith('.'), 'Names cannot start or end with a dot.')
  .refine((n) => !isReserved(n), 'Windows reserves that name. Choose another.')

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
