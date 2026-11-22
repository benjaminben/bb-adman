// list_subjects and get_variant (spec/phases/phase-10.md, A-235, A-249). Both are reads that
// change nothing; each reply goes through its allow-list picker in variant-replies.ts.
import { subjectListInput } from '@/shared/schemas/queries/subject'
import { variantGetInput } from '@/shared/schemas/queries/variant'
import type { ToolDef } from './table'
import { subjectListFields, variantFields } from './variant-replies'

export const READ_MORE_TOOLS: readonly ToolDef[] = [
  {
    name: 'list_subjects',
    description:
      'List the subjects of an open project: for each, its ID, name, description and the IDs ' +
      'of the assets that show it.',
    kind: 'query',
    target: 'subject.list',
    input: subjectListInput,
    reply: subjectListFields,
  },
  {
    name: 'get_variant',
    description:
      'Read one variant of an open project: its fields and badges, its campaign ID, every ' +
      'layer with all its values (z ascending), its video clips, and the ' +
      'assets its layers use, with display name, kind, size and whether the file is missing.',
    kind: 'query',
    target: 'variant.get',
    input: variantGetInput,
    reply: variantFields,
  },
]
