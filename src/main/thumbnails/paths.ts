// spec/scene.md, "Thumbnails": the one owner of the thumbnail file names. The project ID,
// variant ID and rev come from the project file, so each is checked before a path is built.
import path from 'node:path'
import { RENDER_LIMITS } from '@/shared/config/render'

const ULID = /^[0-9A-HJKMNP-TV-Z]{26}$/
const VARIANT_ID = /^[23456789abcdefghjkmnpqrstuvwxyz]{6}$/

// The names the clean-up may delete: a finished thumbnail, or one left half written.
export const THUMBNAIL_NAME = /^[23456789abcdefghjkmnpqrstuvwxyz]{6}-\d+\.png$/
export const PARTIAL_NAME = /^[23456789abcdefghjkmnpqrstuvwxyz]{6}-\d+\.png\.partial$/

export function thumbnailsRoot(userDataDir: string): string {
  return path.join(userDataDir, 'thumbnails')
}

export function thumbnailDir(userDataDir: string, projectId: string): string {
  if (!ULID.test(projectId)) throw new Error('The project ID is not valid for a thumbnail.')
  return path.join(thumbnailsRoot(userDataDir), projectId)
}

export function thumbnailName(variantId: string, rev: number): string {
  if (!VARIANT_ID.test(variantId)) throw new Error('The variant ID is not valid for a thumbnail.')
  if (!Number.isSafeInteger(rev) || rev < 0) {
    throw new Error('The variant rev is not valid for a thumbnail.')
  }
  return `${variantId}-${rev}.png`
}

export function thumbnailFile(
  userDataDir: string,
  projectId: string,
  variantId: string,
  rev: number,
): string {
  const name = thumbnailName(variantId, rev)
  return path.join(thumbnailDir(userDataDir, projectId), name)
}

// The longer side is RENDER_LIMITS.thumbnailSide; the other keeps the shape, at least 1.
export function thumbnailSize(variant: { width: number; height: number }): {
  width: number
  height: number
} {
  return fitSize(variant, RENDER_LIMITS.thumbnailSide)
}

export function fitSize(
  variant: { width: number; height: number },
  longSide: number,
): { width: number; height: number } {
  const long = Math.max(variant.width, variant.height)
  const other = Math.max(1, Math.round((longSide * Math.min(variant.width, variant.height)) / long))
  return variant.width >= variant.height
    ? { width: longSide, height: other }
    : { width: other, height: longSide }
}
