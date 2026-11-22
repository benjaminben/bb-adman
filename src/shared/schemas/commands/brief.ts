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

// The brief.parse reply (SPEC 14 1.42 C4-2), here so the window can import it. subjectPictures
// has one entry per draft subject; brief.parse always sets it, the AI reader never does.
export type BriefParsed = {
  draft: BriefDraft
  primaryLanguage: string | null
  subjectPictures?: SubjectPictures[]
}

// spec/ai-jobs.md "Brief reading": brief.extract reads a Markdown or text brief with AI. The
// handler checks that the path is absolute and names a text brief.
export const briefExtractInput = projectScoped.extend({
  filePath: z.string().min(1),
  provider: z.string().min(1),
})
export type BriefExtractInput = z.infer<typeof briefExtractInput>
