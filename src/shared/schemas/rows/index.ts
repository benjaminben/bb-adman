// SPEC 4.4: one wire row schema per table. rows.ts checks every row it reads against the
// schema of its table. Tables with no entry are added by later phases.
import type { z } from 'zod'
import type { TableName } from './keys'
import { ProjectMetaRow } from './project-meta'
import { SubjectRow } from './subject'

export const ROW_SCHEMAS: Partial<Record<TableName, z.ZodType<Record<string, unknown>>>> = {
  project_meta: ProjectMetaRow,
  subject: SubjectRow,
}
