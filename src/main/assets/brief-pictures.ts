// Round 2 plan D3 [A-343 to A-346] (security class): the pictures a brief a person loads or
// pastes names. The stakeholder lifted the rule that a brief may only name pictures in its
// own folder, so a path may name any file on the disk; the normal import checks still apply.
// An asset ID must be an image of the open project. A bad picture gives a note, never an
// error. Nothing here logs, and no note holds a folder: a note's name is pictureName's.
// The checks of one text live in brief-file-check.ts, shared with the brand files.
import { briefFolderOf, checkBriefFile, type BriefFolder } from './brief-file-check'
import { pictureName } from '@/shared/brief/picture-name'
import type { BriefDraft } from '@/shared/schemas/brief'
import type { SubjectPictures } from '@/shared/schemas/commands/brief'

type Subjects = BriefDraft['subjects']

export type BriefPictureOptions = {
  // True when the open project holds an asset of this ID with kind image. Without it, every
  // asset ID is unknown_asset.
  isImage?: (assetId: string) => boolean
  // Given so a test can judge paths by another system's rules.
  platform?: NodeJS.Platform
}

function picturesOf(subject: NonNullable<Subjects>[number]): string[] {
  const { pictures } = subject
  if (pictures === undefined) return []
  return typeof pictures === 'string' ? [pictures] : pictures
}

async function checkSubject(
  folder: BriefFolder,
  texts: string[],
  options: BriefPictureOptions,
): Promise<SubjectPictures> {
  const result: SubjectPictures = { paths: [], assetIds: [], notes: [] }
  const fileOptions = { isWanted: options.isImage, platform: options.platform }
  for (const text of texts) {
    const checked = await checkBriefFile(async () => folder, text, 'image', fileOptions)
    if ('reason' in checked) result.notes.push({ name: pictureName(text), reason: checked.reason })
    else if ('assetId' in checked) {
      if (!result.assetIds.includes(checked.assetId)) result.assetIds.push(checked.assetId)
    } else if (!result.paths.includes(checked.real)) result.paths.push(checked.real)
  }
  return result
}

// One entry per subject, in order. briefPath is the absolute path of the brief file, or null
// for pasted text, which has no folder.
export async function checkBriefPictures(
  briefPath: string | null,
  subjects: Subjects,
  options: BriefPictureOptions = {},
): Promise<SubjectPictures[]> {
  const folder = await briefFolderOf(briefPath)
  const result: SubjectPictures[] = []
  for (const subject of subjects ?? []) {
    result.push(await checkSubject(folder, picturesOf(subject), options))
  }
  return result
}
