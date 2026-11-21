// Which rows are reference pictures, and which are pre-chosen (spec/subject-photos.md,
// "Subject photos as reference pictures", SP-7). Every reference list keeps the rows
// isReferenceRow passes, and every pre-choice uses subjectPhotoIds: a photo attached to a
// subject is always offered, from either library. Pure: no query, no state.
import { MAX_REFERENCES_PER_RUN } from '@/shared/config/defaults'
import type { AssetList } from '@/shared/schemas/queries/asset'

type Row = AssetList[number]

// Why a picture cannot be sent, or null when it can.
export function whyNot(asset: Row): string | null {
  if (asset.missing) return 'file not found'
  return null
}

export function isReferenceRow(asset: Row): boolean {
  return asset.kind === 'image' && (asset.library === 'reference' || asset.subjectId !== null)
}

// The images attached to these subjects that can be sent, oldest first (IDs are ULIDs), at
// most MAX_REFERENCES_PER_RUN.
export function subjectPhotoIds(rows: AssetList, subjectIds: string[]): string[] {
  return rows
    .filter(
      (a) =>
        isReferenceRow(a) &&
        a.subjectId !== null &&
        subjectIds.includes(a.subjectId) &&
        whyNot(a) === null,
    )
    .map((a) => a.id)
    .sort()
    .slice(0, MAX_REFERENCES_PER_RUN)
}

// The text after an asset-library subject photo's name, so a user knows why an ad picture
// is listed among the reference pictures.
export function photoOfLine(asset: Row): string | null {
  return asset.library === 'asset' && asset.subjectId !== null
    ? `Photo of ${asset.subjectId}`
    : null
}
