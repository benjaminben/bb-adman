// The line each brief photo note shows in its subject row (spec/subject-photos.md, "Notes from
// the brief"). Pure. The name goes through pictureName again here, so a note never shows a
// folder even if a name came with one. A note is shown on screen only: never logged, never put
// in an event.
import { pictureName } from '@/shared/brief/picture-name'
import type { PictureNote, PictureNoteReason } from '@/shared/schemas/commands/brief'

const LINES: Record<PictureNoteReason, (name: string) => string> = {
  outside_folder: (name) =>
    `The photo "${name}" was not used: a brief may only name photos in its own folder or below it.`,
  not_found: (name) => `The photo "${name}" was not found.`,
  not_a_picture: (name) => `The file "${name}" is not a picture Adman can use.`,
  not_readable: (name) => `The photo "${name}" could not be read.`,
  no_folder: (name) =>
    `The photo "${name}" was not used: a typed brief has no folder to find it in.`,
  wide_folder: (name) =>
    `The photo "${name}" was not used: put the brief and its photos in a folder of their own.`,
}

export function noteLine(note: PictureNote): string {
  return LINES[note.reason](pictureName(note.name))
}
