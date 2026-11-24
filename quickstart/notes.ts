// The plain lines the quickstart prints for a brief value or a brief file it cannot use. The
// value lines follow the app's brief form (spec/brief-brand.md "Notes"). A file is named by its
// last part only, so no line shows a folder. Pure.
import { cleanLineText } from '@/shared/brief/bad-line'
import type { BrandValueNote } from '@/shared/brief/brand'
import { pictureName } from '@/shared/brief/picture-name'

export type FileWhat = 'photo' | 'logo' | 'headline font' | 'text font'
export type FileReason = 'not_found' | 'not_readable' | 'not_a_picture' | 'not_a_font'

const PROBLEMS: Record<FileReason, string> = {
  not_found: 'was not found',
  not_readable: 'could not be read',
  not_a_picture: 'is not a PNG, JPEG or WebP picture',
  not_a_font: 'is not a TTF, OTF or WOFF2 font',
}

export function fileNoteLine(what: FileWhat, text: string, reason: FileReason): string {
  return `The ${what} "${pictureName(text)}" ${PROBLEMS[reason]}. It is left out.`
}

const VALUE_LINES: Record<BrandValueNote['reason'], (text: string) => string> = {
  not_a_colour: (text) => `The colour "${text}" is not a hex colour such as #0B3D2E.`,
  unknown_layout: (text) =>
    `The layout "${text}" is not one of the starting layouts. The default is used.`,
  unknown_ads_per: (text) =>
    `Ad sets "${text}" is not "campaign" or "subject". All subjects share one set.`,
}

export function lookNoteLine(note: BrandValueNote): string {
  return VALUE_LINES[note.reason](cleanLineText(note.text))
}
