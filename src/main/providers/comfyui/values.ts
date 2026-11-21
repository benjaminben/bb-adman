// SPEC 6.10.2 (security class): the values that go into a ComfyUI path or body are checked
// first. A value from the server that fails is never used.
import { createHash } from 'node:crypto'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NAME_CHARS = /^[A-Za-z0-9._\-() ]+$/
const SUBFOLDER_CHARS = /^[A-Za-z0-9._\-() /]*$/

export type ViewType = 'temp' | 'output'

export function isPromptId(id: string): boolean {
  return UUID.test(id)
}

// 1 to 128 characters of A-Z a-z 0-9 . _ - ( ) and space; no '..'.
export function isFileName(name: string): boolean {
  return name.length <= 128 && NAME_CHARS.test(name) && !name.includes('..')
}

// 0 to 128 characters of the same set plus '/'; no '..', no leading '/'.
export function isSubfolder(subfolder: string): boolean {
  return (
    subfolder.length <= 128 &&
    SUBFOLDER_CHARS.test(subfolder) &&
    !subfolder.includes('..') &&
    !subfolder.startsWith('/')
  )
}

export function isViewType(type: string): type is ViewType {
  return type === 'temp' || type === 'output'
}

// The name the app gives an upload: adman-{first 16 hex of the SHA-256 of the bytes}.png.
export function uploadName(bytes: Uint8Array): string {
  return `adman-${createHash('sha256').update(bytes).digest('hex').slice(0, 16)}.png`
}
