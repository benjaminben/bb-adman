import { z } from 'zod'
import { projectScoped } from './project-scoped'
import type { BriefDraft } from '@/shared/schemas/brief'

// SPEC 4.2 brief.parse: a file path or pasted text, exactly one of the two (SPEC 6.1).
export const briefParseInput = projectScoped
  .extend({
    filePath: z.string().min(1).optional(),
    text: z.string().optional(),
  })
  .refine((i) => (i.filePath === undefined) !== (i.text === undefined), {
    message: 'Give a file path or text, not both.',
    path: ['filePath'],
  })
export type BriefParseInput = z.infer<typeof briefParseInput>

// spec/subject-photos.md "Schemas" [D-098], as Round 2 plan D3 changed it (A-343): why a
// picture a brief names was not used. not_full_path: pasted text named a relative path;
// unknown_asset: an asset ID that is not an image of the open project.
export type PictureNoteReason =
  'not_found' | 'not_a_picture' | 'not_readable' | 'not_full_path' | 'unknown_asset'
// name: pictureName of the text, never a folder.
export type PictureNote = { name: string; reason: PictureNoteReason }
// paths: real paths that passed every check, in the brief's order, each once. assetIds: the
// image assets of the project the brief named by ID, each once.
export type SubjectPictures = { paths: string[]; assetIds: string[]; notes: PictureNote[] }

// spec/brief-brand.md "Schemas": the three brand files a brief may name, and why one was not
// used. not_a_font: a font role named a file that is not a TTF, OTF or WOFF2 font.
export type BrandRole = 'logo' | 'headingFont' | 'bodyFont'
export type BrandNoteReason = PictureNoteReason | 'not_a_font'
// Exactly one of path and assetId is set. path: a real path that passed every check.
export type BrandFile = { role: BrandRole; path: string | null; assetId: string | null }
// name: pictureName of the text, never a folder.
export type BrandFileNote = { role: BrandRole; name: string; reason: BrandNoteReason }
// files: in role order (logo, heading, body); a role the brief does not name, or one with a
// note, has no entry.
export type BrandFiles = { files: BrandFile[]; notes: BrandFileNote[] }

// The brief.parse reply (SPEC 14 1.42 C4-2), here so the window can import it. subjectPictures
// has one entry per draft subject and brief.parse always sets it. brandFiles is set only when
// the brief names a logo or a font. The AI reader sets neither.
export type BriefParsed = {
  draft: BriefDraft
  primaryLanguage: string | null
  subjectPictures?: SubjectPictures[]
  brandFiles?: BrandFiles
}

// spec/ai-jobs.md "Brief reading": brief.extract reads a Markdown or text brief with AI. The
// handler checks that the path is absolute and names a text brief.
export const briefExtractInput = projectScoped.extend({
  filePath: z.string().min(1),
  provider: z.string().min(1),
})
export type BriefExtractInput = z.infer<typeof briefExtractInput>
