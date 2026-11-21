// SPEC 6.5 [1.13] Errors: an error from the disk is a ProviderFailure of kind other whose
// detail is the error code only (`ENOSPC`, `EACCES`), never a path. The one exception is a
// refused path: the caller's mistake, which stays the plain Error "Storage path refused".
import { ProviderFailure } from '../types'
import { REFUSED_PATH } from '../storage-paths'

function isRefusedPath(error: unknown): boolean {
  return error instanceof Error && error.constructor === Error && error.message === REFUSED_PATH
}

// The detail holds the code, or the error's name when it has no code; never its message.
export function localFailure(error: unknown): unknown {
  if (error instanceof ProviderFailure || isRefusedPath(error)) return error
  const code = (error as NodeJS.ErrnoException | undefined)?.code
  const detail = typeof code === 'string' ? code : error instanceof Error ? error.name : 'Error'
  return new ProviderFailure({ kind: 'other', detail })
}

// A file or folder that is not there, as the disk would say it.
export function notThere(): ProviderFailure {
  return new ProviderFailure({ kind: 'other', detail: 'ENOENT' })
}

// Runs one storage call and lets out only a ProviderFailure or a refused path.
export async function onDisk<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call()
  } catch (error) {
    throw localFailure(error)
  }
}
