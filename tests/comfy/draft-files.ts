// SPEC 14 1.57 H-3: case 1's line per draft workflow, its model files present or missing, by
// the app's own names. It reads only the folder lists the check already fetched for the trial
// workflows, kept as they came back, so nothing new reaches the server. A file in a folder the
// check did not list is said to be "not listed by the check". Node classes are not probed:
// the draft node lists are stand-ins.
import type { CheckClient } from '@/main/providers/comfyui/needs'
import { WORKFLOWS } from '@/main/providers/comfyui/workflows'
import type { WorkflowSpec } from '@/main/providers/comfyui/workflows/types'

export const DRAFT_WORKFLOWS: readonly WorkflowSpec[] = WORKFLOWS.filter(
  (w) => w.status === 'draft',
)

export type FolderLists = Map<string, string[] | null>

// The client with modelFiles wrapped, so each list the check fetches is kept here.
export function keepFolderLists(client: CheckClient): { client: CheckClient; lists: FolderLists } {
  const lists: FolderLists = new Map()
  const kept: CheckClient = {
    systemStats: () => client.systemStats(),
    nodeInfo: (classType) => client.nodeInfo(classType),
    async modelFiles(folder) {
      const list = await client.modelFiles(folder)
      lists.set(folder, list)
      return list
    },
  }
  return { client: kept, lists }
}

// The check's own match rule (needs.ts): the name alone, or at the end of a subfolder path.
const listed = (list: string[], file: string) =>
  list.some((e) => e === file || e.endsWith(`/${file}`))

function fileState(lists: FolderLists, folder: string, file: string): string {
  if (!lists.has(folder)) return 'not listed by the check'
  return listed(lists.get(folder) ?? [], file) ? 'present' : 'missing'
}

export function draftFileLines(
  lists: FolderLists,
  drafts: readonly WorkflowSpec[] = DRAFT_WORKFLOWS,
): string[] {
  return drafts.map((w) => {
    const files = w.needs.models.map(
      (m) => `${m.folder}/${m.file} ${fileState(lists, m.folder, m.file)}`,
    )
    return `${w.id} (draft) model files: ${files.join(', ')}`
  })
}
