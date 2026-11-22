// Which file a publish uploads for an asset row (spec/phases/phase-09.md "Components" and
// "Project-file values that reach a path"). The row comes from a project file that may come
// from anyone, so the file is checked as package.ts checks it: the row's ID a ULID, the path
// resolved as resolveRow does, a regular file, its extension listed for the row's kind (text
// never), its first bytes fitting. The extension handed back is the table's for that type,
// never the file name's own spelling.
import path from 'node:path'
import type { ProjectHandle } from '@/main/db/project-file'
import { resolveRow } from '@/main/assets/service'
import { sniffFile } from '@/main/assets/inspect'
import { fileTypeFor } from '@/shared/config/file-types'
import { isUlid } from '@/shared/publish/paths'
import type { PublishComponent } from '@/shared/schemas/queries/publish'
import type { AssetRow } from '@/shared/schemas/rows/asset'

export type ComponentKind = PublishComponent['kind']
export type ComponentProblem = NonNullable<PublishComponent['problem']>
export type ComponentFile = { absPath: string; ext: string } | { problem: ComponentProblem }

const KINDS: readonly string[] = ['image', 'video', 'font'] satisfies ComponentKind[]

export const isComponentKind = (kind: string): kind is ComponentKind => KINDS.includes(kind)

export async function checkComponentFile(
  handle: ProjectHandle,
  row: AssetRow,
): Promise<ComponentFile> {
  // A bad ID is treated as missing, as package.ts does.
  if (!isUlid(row.id)) return { problem: 'missing' }
  if (!isComponentKind(row.kind)) return { problem: 'wrong_type' }
  const file = await resolveRow(handle, row)
  if (file === 'missing') return { problem: 'missing' }
  const type = fileTypeFor(path.basename(file))
  if (type?.kind !== row.kind) return { problem: 'wrong_type' }
  if ((await sniffFile(file)) !== type) return { problem: 'wrong_type' }
  return { absPath: file, ext: type.extensions[0] as string }
}
