import { z } from 'zod'
import { isReserved } from '../config/reserved-names'

// The one rule for a project name (SPEC 14 [1.30] U1). project.create checks a typed name with
// it, and every open checks the stored name with it, exactly as stored. It lives here so that
// schemas/project.ts and schemas/commands/project.ts can both read it without an import circle.

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

// A stored name passes when the rule accepts it and it equals its trimmed self.
export const storedProjectName = z
  .string()
  .refine((n) => n === n.trim() && projectName.safeParse(n).success)
