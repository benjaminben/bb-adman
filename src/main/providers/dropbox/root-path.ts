// The Dropbox folder check (spec/phases/phase-09.md "Dropbox tokens", A-213). A rootPath is
// checked before it is saved, and a saved one again before any later use, since
// settings.json can be edited by hand. '' is the app folder itself. Otherwise: at most 200
// characters, no control character, and every part passes the storage path rules (no '..',
// no '.', no empty part, so no leading or trailing '/').
import { storageFilePath } from '@/main/providers/storage-paths'
import { DROPBOX_ROOT_PATH_MAX } from '@/shared/schemas/commands/storage'

const CONTROL = /\p{Cc}/u

export function isDropboxRootPath(rootPath: string): boolean {
  if (rootPath === '') return true
  if (rootPath.length > DROPBOX_ROOT_PATH_MAX || CONTROL.test(rootPath)) return false
  try {
    storageFilePath(rootPath)
    return true
  } catch {
    return false
  }
}
