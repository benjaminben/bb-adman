// SPEC 6: StorageProvider paths are relative, use '/', never start with '/' and never hold
// '..'. Every storage adapter checks paths here before joining them to its own root, so the
// local folder and the cloud ones share the path code (SPEC 6, REQ 9.1 preference).

import { isReserved } from '../../shared/config/reserved-names'

// The one error for a path that breaks the rules or would leave the root. It holds no path
// (SPEC 6.5 [1.13] Errors, [1.14] H10).
export const REFUSED_PATH = 'Storage path refused'

export function refusePath(): never {
  throw new Error(REFUSED_PATH)
}

// [1.14] H14, [1.17]: Windows name forms are refused on every platform, so one export gives
// the same paths everywhere: a part that ends in a dot or a space, holds ':' (a drive letter
// or a stream) or '\\', or is a reserved device name.
// [1.20] B-01: also a part that holds a character Windows cannot hold in a name, or a control
// character (code 1 to 31; code 0 is refused for the whole path below).
const NOT_IN_NAMES = new Set(['<', '>', '"', '|', '?', '*'])

function holdsBadCharacter(part: string): boolean {
  return [...part].some((c) => NOT_IN_NAMES.has(c) || c.charCodeAt(0) < 32)
}

function isWindowsForm(part: string): boolean {
  if (part.endsWith('.') || part.endsWith(' ') || part.includes(':')) return true
  return holdsBadCharacter(part) || isReserved(part)
}

function checkParts(path: string): void {
  if (path.includes('\\') || path.includes('\u0000')) refusePath()
  for (const part of path.split('/')) {
    if (part === '' || part === '.' || part === '..' || isWindowsForm(part)) refusePath()
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
