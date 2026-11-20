import { z } from 'zod'

// SPEC 4.1: every project-scope command and query extends this base object, so the
// field has one name, one type and one place.
export const projectScoped = z.object({ projectId: z.string().min(1) })
export type ProjectScoped = z.infer<typeof projectScoped>
