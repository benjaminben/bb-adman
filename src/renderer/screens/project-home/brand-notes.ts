// The lines the brief form shows for the brief's brand (spec/brief-brand.md, "The brief form",
// "Notes"). Pure. A file name goes through pictureName, so a note never shows a folder; any
// other text goes through cleanLineText, so nothing hidden or reordering is shown. A note is
// shown on screen only: never logged, never put in an event.
import { cleanLineText } from '@/shared/brief/bad-line'
import { pictureName } from '@/shared/brief/picture-name'
import type { BrandValueNote } from '@/shared/brief/brand'
import type { BrandFileNote, BrandNoteReason, BrandRole } from '@/shared/schemas/commands/brief'

const WHAT: Record<BrandRole, string> = {
  logo: 'logo',
  headingFont: 'headline font',
  bodyFont: 'text font',
}

const FILE_LINES: Record<BrandNoteReason, (what: string, name: string, role: BrandRole) => string> =
  {
    not_found: (what, name) => `The ${what} "${name}" was not found.`,
    not_a_picture: (_, name) => `The logo "${name}" is not a picture Adman can use.`,
    not_a_font: (_, name) =>
      `The file "${name}" is not a font Adman can use. Use TTF, OTF or WOFF2.`,
    not_readable: (what, name) => `The ${what} "${name}" could not be read.`,
    not_full_path: (what, name) =>
      `The ${what} "${name}" was not used: a pasted brief has no folder, so give its full path or its asset ID.`,
    unknown_asset: (_, name, role) =>
      `No ${role === 'logo' ? 'picture' : 'font'} with the asset ID "${name}" is in this project's asset library.`,
  }

const VALUE_LINES: Record<BrandValueNote['reason'], (text: string) => string> = {
  not_a_colour: (text) => `The colour "${text}" is not a hex colour such as #0B3D2E.`,
  unknown_layout: (text) =>
    `The layout "${text}" is not one of Adman's starting layouts. The default is used.`,
  unknown_ads_per: (text) =>
    `Ad sets "${text}" is not "campaign" or "subject". All subjects share one set.`,
}

export function brandFileNoteLine(note: BrandFileNote): string {
  return FILE_LINES[note.reason](WHAT[note.role], pictureName(note.name), note.role)
}

// An asset.import of a brand file that was refused; message is the refusal's own message.
export function brandImportNoteLine(role: BrandRole, message: string): string {
  return `The brief's ${WHAT[role]} could not be added: ${cleanLineText(message)}`
}

export function brandValueNoteLine(note: BrandValueNote): string {
  return VALUE_LINES[note.reason](cleanLineText(note.text))
}
