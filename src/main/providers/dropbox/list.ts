// Listing a folder in Dropbox (spec/phases/phase-09.md "Dropbox hosts and calls", spec/storage-
// and-publish.md "Rules for every implementation"). files/list_folder with recursive: true, then
// list_folder/continue until the last page. Only files are kept, only those whose path_lower and
// path_display both sit under the asked folder, and only those whose path, with the root cut
// off, passes the storage path rules, so each can be handed straight to read and remove. A
// folder that is not there, or a file named as the folder, lists nothing.
import { z } from 'zod'
import { storageFilePath } from '@/main/providers/storage-paths'
import type { DropboxCalls } from './dropbox-storage'

const Entry = z.object({
  '.tag': z.string(),
  path_lower: z.string().optional(),
  path_display: z.string().optional(),
})
const Page = z.object({
  entries: z.array(Entry),
  cursor: z.string().max(100_000),
  has_more: z.boolean(),
})
type Entry = z.infer<typeof Entry>

const NOT_A_FOLDER = ['path/not_found', 'path/not_folder']

// The path relative to the root, or null for an entry that is not kept. The shown prefix is
// lower-cased on its own and must equal `under` exactly, so each of its characters lower-cases
// to one; the root is then cut by its lower-case length (`cut`), which a character such as a
// capital dotted I cannot shift.
function relative(entry: Entry, under: string, cut: number): string | null {
  const display = entry.path_display
  if (entry['.tag'] !== 'file' || !entry.path_lower?.startsWith(under) || !display) return null
  if (display.slice(0, under.length).toLowerCase() !== under) return null
  try {
    return storageFilePath(display.slice(cut))
  } catch {
    return null
  }
}

// `folder` is the Dropbox folder to list ('' for the app folder); `root` is the root with its
// '/' at the end, cut off each path returned.
export async function listFiles(
  calls: DropboxCalls,
  folder: string,
  root: string,
): Promise<string[]> {
  const under = `${folder}/`.toLowerCase()
  const cut = root.toLowerCase().length
  const first = await calls.rpc('listFolder', { path: folder, recursive: true })
  let page = await calls.lookup(first, Page, NOT_A_FOLDER)
  const found: string[] = []
  while (page) {
    for (const entry of page.entries) {
      const path = relative(entry, under, cut)
      if (path !== null) found.push(path)
    }
    if (!page.has_more) break
    page = await calls.answer(await calls.rpc('listContinue', { cursor: page.cursor }), Page)
  }
  return found
}
