// The pictures of a brief an agent sends (spec/phases/round-2-platform.md, D3 and D6, step 4).
// Each picture text is read by pictureRef, subject by subject in order. A relative text is
// refused with no disk read; an asset ID must name a picture of this project that is no other
// subject's photo; a full path is only kept here, for the D5 text rules, which run over the
// whole brief's paths (file-path-text.ts, through importPathTexts). Every refusal names the
// picture by its place, never by its text.
import path from 'node:path'
import type Database from 'better-sqlite3'
import { eq } from 'drizzle-orm'
import type { ProjectContext } from '@/main/commands/types'
import { asset } from '@/main/db/schema'
import { readWireRow } from '@/main/db/rows'
import { importPathTexts } from '@/main/assets/import-files'
import { pictureRef } from '@/shared/brief/picture-refs'
import { fileTypeFor } from '@/shared/config/file-types'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import { AppError } from '@/shared/schemas/result'

// One brief subject's pictures as their texts, and the subject ID they attach to.
export type SubjectPictures = { subjectId: string; texts: string[] }

// A picture's place in the brief, 1-based: subject i, picture j.
type Place = { subject: number; picture: number }

export type PicturePlan = {
  // Each asset ID the brief names, once, with the subject it goes to.
  assets: Array<{ assetId: string; subjectId: string }>
  // Each full path, in brief order, with the subject it goes to and its place.
  files: Array<{ text: string; subjectId: string; place: Place }>
}

const at = ({ subject, picture }: Place) => `Subject ${subject}, picture ${picture}`

const otherSubject = (place: Place) =>
  new AppError('RULE_VIOLATION', `${at(place)} is already a photo of another subject.`, {
    reason: 'photo_of_other_subject',
  })

const briefNamesFiles = () =>
  new AppError(
    'RULE_VIOLATION',
    'This brief names files. Send it again through the tool so the user can be asked.',
    { reason: 'brief_names_files' },
  )

// An asset ID: a picture of this project, not another subject's photo (FR-011).
function checkAsset(db: Database.Database, assetId: string, subjectId: string, place: Place) {
  const row = readWireRow(db, 'asset', { id: assetId }) as AssetRow | null
  if (!row || row.kind !== 'image') {
    throw new AppError(
      'NOT_FOUND',
      `${at(place)}: no picture with that asset ID is in this project.`,
      { reason: 'unknown_asset' },
    )
  }
  if (row.subjectId !== null && row.subjectId !== subjectId) throw otherSubject(place)
}

export function checkPictures(
  db: Database.Database,
  subjects: readonly SubjectPictures[],
  withFiles: boolean,
  platform: NodeJS.Platform,
): PicturePlan {
  const plan: PicturePlan = { assets: [], files: [] }
  const goesTo = new Map<string, string>()
  subjects.forEach(({ subjectId, texts }, i) => {
    texts.forEach((text, j) => {
      const place = { subject: i + 1, picture: j + 1 }
      const ref = pictureRef(text, platform)
      if (ref.kind === 'relative') {
        throw new AppError(
          'INVALID_INPUT',
          `${at(place)} is neither an asset ID nor a full file path. A brief sent as text ` +
            'has no folder.',
          { reason: 'picture_not_full_path' },
        )
      }
      if (ref.kind === 'file') {
        if (!withFiles) throw briefNamesFiles()
        plan.files.push({ text, subjectId, place })
        return
      }
      checkAsset(db, ref.assetId, subjectId, place)
      const planned = goesTo.get(ref.assetId)
      if (planned !== undefined && planned !== subjectId) throw otherSubject(place)
      if (planned === undefined) plan.assets.push({ assetId: ref.assetId, subjectId })
      goesTo.set(ref.assetId, subjectId)
    })
  })
  return plan
}

const notAPicture = (n: number) =>
  new AppError('INVALID_INPUT', `File ${n} is not a picture Adman can use.`, {
    reason: 'not_supported',
    index: n,
  })

// The D5 text rules over the brief's paths, kind image only: the normalised paths the user is
// shown, or INVALID_INPUT with { reason, index }, index counting the brief's paths in order.
export function briefPathTexts(texts: readonly string[], platform = process.platform): string[] {
  let paths: string[]
  try {
    paths = importPathTexts(texts, platform)
  } catch (e) {
    const details = e instanceof AppError ? e.details : undefined
    if (details?.reason === 'not_supported') throw notAPicture(Number(details.index))
    throw e
  }
  const base = platform === 'win32' ? path.win32.basename : path.posix.basename
  paths.forEach((p, i) => {
    if (fileTypeFor(base(p))?.kind !== 'image') throw notAPicture(i + 1)
  })
  return paths
}

// Attaches each picture to its subject: the asset IDs the brief names, then each imported
// file's asset (one ID per path, in brief order). A file whose bytes the project already held
// as another subject's photo is refused by its place, as an asset ID would be.
export function attachPictures(ctx: ProjectContext, plan: PicturePlan, fileIds: string[]) {
  const goesTo = new Map(plan.assets.map((a) => [a.assetId, a.subjectId]))
  plan.files.forEach((f, i) => {
    const assetId = fileIds[i]
    if (assetId === undefined) throw new Error('every brief file has an asset ID')
    const planned = goesTo.get(assetId)
    if (planned !== undefined && planned !== f.subjectId) throw otherSubject(f.place)
    const row = readWireRow(ctx.project.db, 'asset', { id: assetId }) as AssetRow | null
    if (row?.subjectId && row.subjectId !== f.subjectId) throw otherSubject(f.place)
    goesTo.set(assetId, f.subjectId)
  })
  for (const [assetId, subjectId] of goesTo) {
    ctx.project.orm.update(asset).set({ subjectId }).where(eq(asset.id, assetId)).run()
    ctx.changes.touch('asset', { id: assetId })
  }
}
