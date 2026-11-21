// spec/phases/phase-06.md, design additions 1 and 2: the translation commands. Unknown keys
// are refused, so no caller can send a status or a source.
import { z } from 'zod'
import { projectScoped } from './project-scoped'

const id = z.string().min(1)
const TranslationStatus = z.enum(['missing', 'proposed', 'approved'])
const TranslationSource = z.enum(['ai', 'agent', 'user', 'brief'])

// The longest translation, as layer.update's copy.
export const MAX_TRANSLATION_CHARS = 5000

// translation.propose (A-154, A-157): either variantIds, or directionId with language. 'sync'
// only from the sync review (P6-16).
export const translationProposeInput = projectScoped
  .extend({
    provider: id,
    variantIds: z.array(id).min(1).max(500).optional(),
    directionId: id.optional(),
    language: id.optional(),
    mode: z.enum(['write', 'sync']).default('write'),
  })
  .strict()
  .refine(
    (i) =>
      i.variantIds !== undefined
        ? i.directionId === undefined && i.language === undefined
        : i.directionId !== undefined && i.language !== undefined,
    { message: 'Name the posts, or a direction and a language.', path: ['variantIds'] },
  )
export type TranslationProposeInput = z.infer<typeof translationProposeInput>
export type TranslationProposeReply = { jobIds: string[] }

// translation.set (A-160, A-162): never approved, whoever sends it [REQ: FR-200].
export const translationSetInput = projectScoped
  .extend({
    layerId: id,
    text: z.string().max(MAX_TRANSLATION_CHARS),
    applyToSameLanguage: z.boolean(),
  })
  .strict()
export type TranslationSetInput = z.infer<typeof translationSetInput>

// translation.approve (A-159).
export const translationApproveInput = projectScoped
  .extend({ layerIds: z.array(id).min(1).max(2000) })
  .strict()
export type TranslationApproveInput = z.infer<typeof translationApproveInput>

// set, approve and restore answer the layers written.
export type TranslationLayersReply = { layerIds: string[] }

// translation.exportSheet: the path's own checks are in the command (P6-7), with their words.
export const translationExportSheetInput = projectScoped
  .extend({ campaignId: id, filePath: z.string().min(1) })
  .strict()
export type TranslationExportSheetInput = z.infer<typeof translationExportSheetInput>
export type TranslationExportSheetReply = { path: string; rowCount: number }

// translation.write (A-155): system command, sent by the translation job with its cleaned
// answer (A-168). The layers come from the job's own request, never from this input.
export const translationWriteInput = projectScoped
  .extend({
    jobId: id,
    items: z.array(z.object({ key: id, text: z.string().min(1) }).strict()),
  })
  .strict()
export type TranslationWriteInput = z.infer<typeof translationWriteInput>
export type TranslationWriteReply = { written: number }

// translation.restore (A-160): system command, the inverse of set and approve and its own.
// It writes exactly these values; syncedCopyRev is synced_revs.copy.
export const TranslationRestoreItem = z
  .object({
    layerId: id,
    copy: z.string().nullable(),
    translationStatus: TranslationStatus.nullable(),
    translationSource: TranslationSource.nullable(),
    syncedCopyRev: z.number().int().min(0),
  })
  .strict()
export type TranslationRestoreItem = z.infer<typeof TranslationRestoreItem>

export const translationRestoreInput = projectScoped
  .extend({ items: z.array(TranslationRestoreItem).min(1).max(2000) })
  .strict()
export type TranslationRestoreInput = z.infer<typeof translationRestoreInput>
