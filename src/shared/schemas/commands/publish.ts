// publish.run (spec/phases/phase-09.md "Publishing"). The input is strict and bounded. The
// campaign ID is checked against the campaign ID form by the command, after the campaign is
// found, so an unknown campaign is NOT_FOUND first (refusal order, A-221).
import { z } from 'zod'
import { noControlCharacters } from './export'
import { projectScoped } from './project-scoped'

// The storages a publish can go to. `fake` is offered only when the fake provider is listed.
export const PUBLISH_STORAGE_IDS = ['s3', 'dropbox', 'fake'] as const
export const publishStorageId = z.enum(PUBLISH_STORAGE_IDS)
export type PublishStorageId = z.infer<typeof publishStorageId>

export const PROCEED_REASON_MAX = 500

export const publishRunInput = projectScoped
  .extend({
    campaignId: z.string().min(1).max(200),
    storage: publishStorageId,
    replaceConfirmed: z.boolean(),
    proceedDespiteWarnings: z.boolean(),
    // As export.run's reason: it goes into the report, never into the job row or a log line.
    proceedReason: z.string().trim().max(PROCEED_REASON_MAX).refine(noControlCharacters).optional(),
  })
  .strict()
export type PublishRunInput = z.infer<typeof publishRunInput>
export type PublishRunReply = { jobId: string }

// publish.setFontConsent (A-260): this machine's consent to share one font of the project. The
// asset ID is checked against the project's rows by the command, so a bad one is NOT_FOUND.
export const publishSetFontConsentInput = projectScoped
  .extend({ assetId: z.string().min(1).max(200), allowed: z.boolean() })
  .strict()
export type PublishSetFontConsentInput = z.infer<typeof publishSetFontConsentInput>
export type PublishSetFontConsentReply = Record<string, never>
