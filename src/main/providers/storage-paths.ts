// SPEC 6: StorageProvider paths are relative, use '/', never start with '/' and never hold
// '..'. Every storage adapter checks paths here before joining them to its own root, so the
// local folder and the cloud ones share the path code (SPEC 6, REQ 9.1 preference).

// The one error for a path that breaks the rules or would leave the root. It holds no path
// (SPEC 6.5 [1.13] Errors, [1.14] H10).
export const REFUSED_PATH = 'Storage path refused'

export function refusePath(): never {
  throw new Error(REFUSED_PATH)
}

function checkParts(path: string): void {
  if (path.includes('\\') || path.includes('\u0000')) refusePath()
  if (/^[A-Za-z]:/.test(path)) refusePath()
  for (const part of path.split('/')) {
    if (part === '' || part === '.' || part === '..') refusePath()
  }
}

// A path to one file. Returned unchanged when it is allowed.
export function storageFilePath(path: string): string {
  checkParts(path)
  return path
}

// The folder a list call reads: '' for the whole root, otherwise the folder with one '/' at
// the end, so 'a' never matches 'ab.txt'.
export function storageListPrefix(prefix: string): string {
  if (prefix === '') return ''
  const folder = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix
  checkParts(folder)
  return `${folder}/`
}
