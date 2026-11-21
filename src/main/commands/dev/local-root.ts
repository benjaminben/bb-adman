// SPEC 4.2 notes [1.21] F-01: the local hand-test root and the check made before every `local`
// action. The root and the hand-test folder inside it are looked at with lstat: if either is
// there and is a link, or is there and is not a folder, the action is refused. [1.22] M8: any
// other lstat error than ENOENT is a ProviderFailure of kind `other` with the code as detail.
import fs from 'node:fs/promises'
import nodePath from 'node:path'
import { HAND_TEST_FOLDER, HAND_TEST_LOCAL_ROOT } from '../../../shared/config/dev-tools'
import { AppError } from '../../../shared/schemas/result'
import { ProviderFailure } from '../../providers/types'

export const FOLDER_UNSAFE =
  'The hand-test folder holds a link and cannot be used. Remove the link and try again.'

export function folderUnsafe(): AppError {
  return new AppError('RULE_VIOLATION', FOLDER_UNSAFE, { reason: 'storage_folder_unsafe' })
}

export function handTestLocalRoot(userDataDir: string): string {
  return nodePath.join(userDataDir, HAND_TEST_LOCAL_ROOT)
}

// True when there is something at `path` (links not followed); refused when it is a link or
// not a folder. A missing root means nothing below it to look at.
async function folderOrMissing(path: string): Promise<boolean> {
  const stats = await fs.lstat(path).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') return undefined
    throw new ProviderFailure({ kind: 'other', detail: error.code ?? 'lstat failed' })
  })
  if (stats === undefined) return false
  if (stats.isSymbolicLink() || !stats.isDirectory()) throw folderUnsafe()
  return true
}

export async function checkLocalRoot(root: string): Promise<void> {
  if (await folderOrMissing(root)) await folderOrMissing(nodePath.join(root, HAND_TEST_FOLDER))
}
