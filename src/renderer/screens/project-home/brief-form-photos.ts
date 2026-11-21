// The photo rules of the brief form (spec/subject-photos.md, "The model" and "Problem lines";
// D-098). Pure. A row's photos are its form photos still in the project's pictures, plus, for
// an "existing" row with a chosen subject, every picture attached to that subject.
import type { AssetUpdateInput } from '@/shared/schemas/commands/asset'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { SubjectChoice } from './brief-form-model'

// The row's "Use the photos" choice (A-110): its type, its default and what it sends for each
// photo this form adds. Everything about the choice lives in these three.
export type PhotoUse = 'asset' | 'reference'
export const DEFAULT_PHOTO_USE: PhotoUse = 'asset'
export function photoUseUpdate(use: PhotoUse): Pick<AssetUpdateInput, 'library'> {
  return { library: use }
}

// asset.list { projectId, kind: 'image' }; null while not read.
export type ProjectImages = AssetList | null

export type RowPhoto = {
  asset: AssetList[number]
  attached: boolean // attached to the row's chosen subject before the form opened
  added: boolean // a form photo this form imported as a new asset
}

const ONE = 'One photo belongs to one subject.'

// Attached pictures first, oldest first, then the form photos in the order added. A form
// photo no longer in images is left out (it was removed elsewhere); one already attached to
// the row's own subject shows once, as attached. An attached picture whose file is missing
// still counts (A-113).
export function rowPhotos(row: SubjectChoice, images: AssetList): RowPhoto[] {
  const pictures = images.filter((a) => a.kind === 'image')
  const own = row.mode === 'existing' ? row.existingId : null
  const attached = pictures
    .filter((a) => own !== null && a.subjectId === own)
    .sort((a, b) => (a.createdAt < b.createdAt ? -1 : a.createdAt > b.createdAt ? 1 : 0))
    .map((asset) => ({ asset, attached: true, added: false }))
  const shown = new Set(attached.map((p) => p.asset.id))
  const form = row.photos.flatMap((photo) => {
    const asset = pictures.find((a) => a.id === photo.assetId)
    if (asset === undefined || shown.has(asset.id)) return []
    shown.add(asset.id)
    return [{ asset, attached: false, added: photo.added }]
  })
  return [...attached, ...form]
}

// The five photo lines, each kind over every row before the next kind. While the pictures
// are not read, only line 1 shows.
export function photoProblems(
  subjects: SubjectChoice[],
  images: ProjectImages,
  refused: boolean,
): string[] {
  if (images === null) {
    return [
      refused
        ? "The project's pictures could not be read."
        : "The project's pictures are still being read.",
    ]
  }
  const rows = subjects.map((s, i) => ({ s, n: i + 1, photos: rowPhotos(s, images) }))
  const chosen = ({ s }: (typeof rows)[number]) => s.mode === 'new' || s.existingId !== null
  return [
    ...rows
      .filter(({ s }) => s.adding)
      .map(({ n }) => `Subject ${n}: wait for the photos to be added.`),
    ...rows
      .filter((r) => chosen(r) && r.photos.length === 0)
      .map(({ n }) => `Subject ${n}: add at least one photo.`),
    ...rows.flatMap(({ n, photos }) =>
      photos
        .filter((p) => !p.attached && !p.added && p.asset.subjectId !== null)
        .map(
          ({ asset }) =>
            `Subject ${n}: the photo "${asset.displayName}" belongs to the subject "${asset.subjectId}". ${ONE}`,
        ),
    ),
    ...rows.flatMap(({ n, photos }) =>
      photos.flatMap(({ asset }) => {
        const first = rows.find((r) => r.n < n && r.photos.some((p) => p.asset.id === asset.id))
        return first
          ? [`Subjects ${first.n} and ${n} use the same photo "${asset.displayName}". ${ONE}`]
          : []
      }),
    ),
  ]
}

// The asset.update list "Create campaign" sends after subject.create, row by row, then photo
// by photo. ids: each row's subject ID (subjectIds). An added photo gets the row's choice
// (photoUseUpdate); a reused one keeps its own library (A-115); an attached one needs nothing.
export function attachPlan(
  projectId: string,
  subjects: SubjectChoice[],
  ids: string[],
  images: AssetList,
): AssetUpdateInput[] {
  return subjects.flatMap((row, i) => {
    const subjectId = ids[i] ?? ''
    return rowPhotos(row, images).flatMap(({ asset, attached, added }): AssetUpdateInput[] => {
      if (attached) return []
      if (added) return [{ projectId, assetId: asset.id, subjectId, ...photoUseUpdate(row.use) }]
      return asset.subjectId === null ? [{ projectId, assetId: asset.id, subjectId }] : []
    })
  })
}
