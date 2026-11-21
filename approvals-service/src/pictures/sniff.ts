import 'server-only'
// spec/approvals-service-visitor.md "Pictures": the type comes from the first bytes only, never
// from the reply's own Content-Type.
import type { PictureType } from './source'

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
const JPEG = [0xff, 0xd8, 0xff]

const startsWith = (bytes: Uint8Array, start: number[]) =>
  bytes.length >= start.length && start.every((byte, i) => bytes[i] === byte)

export function sniff(bytes: Uint8Array): PictureType | null {
  if (startsWith(bytes, PNG)) return 'image/png'
  if (startsWith(bytes, JPEG)) return 'image/jpeg'
  return null
}
