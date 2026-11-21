// SPEC 4.2 dev.storage: every storage call the hand-test command makes. Each path it sends is
// inside the hand-test folder and passes the shared path rules; any other path a provider
// answers from list is dropped, so remove never names it.
import { HAND_TEST_FOLDER } from '../../../shared/config/dev-tools'
import { AppError } from '../../../shared/schemas/result'
import { storageFilePath } from '../../providers/storage-paths'
import type { StorageProvider } from '../../providers/types'

const FOLDER = `${HAND_TEST_FOLDER}/`

function isInside(path: string): boolean {
  if (!path.startsWith(FOLDER)) return false
  try {
    storageFilePath(path)
    return true
  } catch {
    return false
  }
}

// The storage path for a file name. The name must be one allowed part (no '/').
export function handTestPath(name: string): string {
  const path = `${FOLDER}${name}`
  if (name.includes('/') || !isInside(path)) {
    throw new AppError('INVALID_INPUT', 'That file name cannot be used in storage.')
  }
  return path
}

export async function writeHandTest(
  storage: StorageProvider,
  name: string,
  bytes: Uint8Array,
): Promise<void> {
  await storage.write(handTestPath(name), bytes, 'application/octet-stream')
}

async function pathsInFolder(storage: StorageProvider): Promise<string[]> {
  return (await storage.list(HAND_TEST_FOLDER)).filter(isInside).sort()
}

// The names inside the folder, sorted.
export async function listHandTest(storage: StorageProvider): Promise<string[]> {
  return (await pathsInFolder(storage)).map((path) => path.slice(FOLDER.length))
}

// Removes every file in the folder and returns how many.
export async function removeHandTest(storage: StorageProvider): Promise<number> {
  const paths = await pathsInFolder(storage)
  if (paths.length > 0) await storage.remove(paths)
  return paths.length
}
