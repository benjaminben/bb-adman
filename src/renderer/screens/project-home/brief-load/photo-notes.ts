// The line each brief photo note shows in its subject row (spec/subject-photos.md, "Notes from
// the brief"; Round 2 plan D3). Pure. The name goes through pictureName again here, so a note
// never shows a folder even if a name came with one. A note is shown on screen only: never
// logged, never put in an event.
import { pictureName } from '@/shared/brief/picture-name'
import type { PictureNote, PictureNoteReason } from '@/shared/schemas/commands/brief'

const LINES: Record<PictureNoteReason, (name: string) => string> = {
  not_found: (name) => `The photo "${name}" was not found.`,
  not_a_picture: (name) => `The file "${name}" is not a picture Adman can use.`,
  not_readable: (name) => `The photo "${name}" could not be read.`,
  not_full_path: (name) =>
    `The photo "${name}" was not used: a pasted brief has no folder, so give the photo's full path or its asset ID.`,
  unknown_asset: (name) => `No picture with the asset ID "${name}" is in this project.`,
}

export function noteLine(note: PictureNote): string {
  return LINES[note.reason](pictureName(note.name))
}
