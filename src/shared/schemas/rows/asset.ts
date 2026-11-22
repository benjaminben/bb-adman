import { z } from 'zod'

// SPEC 3.3 asset, in wire form (SPEC 4.4).
export const AssetRow = z.object({
  id: z.string(),
  library: z.enum(['reference', 'asset']),
  kind: z.enum(['image', 'video', 'font', 'text', 'audio']),
  origin: z.enum(['imported', 'generated']),
  storage: z.enum(['linked', 'managed']),
  subjectId: z.string().nullable(),
  displayName: z.string(),
  absPath: z.string(),
  relPath: z.string(),
  mime: z.string(),
  byteSize: z.number().int(),
  mtimeMs: z.number(),
  contentHash: z.string(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  durationMs: z.number().int().nullable(),
  fontFamily: z.string().nullable(),
  fontPublishAllowed: z.boolean(),
  genRunId: z.string().nullable(),
  genProvider: z.string().nullable(),
  genModel: z.string().nullable(),
  genPrompt: z.string().nullable(),
  createdAt: z.string(),
})
export type AssetRow = z.infer<typeof AssetRow>
