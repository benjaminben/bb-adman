import { z } from 'zod'
import { PROJECT_EXTENSION } from '../project'

// A project name becomes a file name, so it must be safe on macOS and Windows.
const FORBIDDEN = /[/\\:*?"<>|]/
// Device names Windows reserves, in any letter case (SPEC 4.2 notes). Windows looks at the
// part before the first dot, with spaces dropped from its end.
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i
const isReserved = (n: string) => WINDOWS_RESERVED.test((n.split('.')[0] ?? '').trimEnd())
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

export const projectCloseInput = z.object({ projectId: z.string().min(1) })
