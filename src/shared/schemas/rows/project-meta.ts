import { z } from 'zod'

// SPEC 3.3 project_meta, in wire form (SPEC 4.4).
export const ProjectMetaRow = z.object({ key: z.string(), value: z.string() })
export type ProjectMetaRow = z.infer<typeof ProjectMetaRow>
