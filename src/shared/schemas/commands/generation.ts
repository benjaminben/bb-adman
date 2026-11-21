import { z } from 'zod'
import { projectScoped } from './project-scoped'
import { MAX_COPY_OPTIONS } from '@/shared/config/copy-options'
import { MAX_IMAGES_PER_RUN } from '@/shared/config/defaults'
import { referenceIds } from '@/shared/schemas/reference-ids'

// S2-4 [D-088]: the user confirmed the commercial licence of the run's model. The command
// ignores it for an agent, and the agent tools below do not offer it.
export const licenceConfirmed = z.literal(true).optional()

const runImagesFields = projectScoped.extend({
  variantId: z.string().min(1),
  slot: z.string().min(1).optional(),
  layerId: z.string().min(1).optional(),
  prompt: z.string().trim().min(1, 'Enter a prompt.'),
  referenceAssetIds: referenceIds,
  count: z.number().int().min(1).max(MAX_IMAGES_PER_RUN),
  provider: z.string().min(1),
})

const oneTarget = (i: { slot?: string; layerId?: string }) =>
  (i.slot === undefined) !== (i.layerId === undefined)
const ONE_TARGET = { message: 'Name a slot or a layer.', path: ['slot'] }

// SPEC 4.2 generation.runImages [1.8]. Built in Phase 2 slice H. A slot or a layer, not both.
export const generationRunImagesInput = runImagesFields
  .extend({ licenceConfirmed })
  .refine(oneTarget, ONE_TARGET)
export type GenerationRunImagesInput = z.infer<typeof generationRunImagesInput>

// The generate_images tool's input: the same, without licenceConfirmed.
export const generationRunImagesAgentInput = runImagesFields.refine(oneTarget, ONE_TARGET)

// SPEC 4.2 generation.startVideo, with the 1.24 start and references [REQ: FR-286]. Built in
// CU-6a, which accepts only start 'none' with useReferences false and no references.
const startVideoFields = projectScoped.extend({
  variantId: z.string().min(1),
  prompt: z.string().trim().min(1, 'Enter a prompt.'),
  durationMs: z.number().int().positive(),
  provider: z.string().min(1),
  start: z.enum(['none', 'first_frame']),
  useReferences: z.boolean(),
  referenceAssetIds: referenceIds,
})

export const generationStartVideoInput = startVideoFields.extend({ licenceConfirmed })
export type GenerationStartVideoInput = z.infer<typeof generationStartVideoInput>

// The generate_video tool's input: the same, without licenceConfirmed.
export const generationStartVideoAgentInput = startVideoFields

// spec/ai-jobs.md "Commands, queries and agent rows" (Phase 4). Each requires provider, so an
// agent never runs on the user's default. Unknown keys are dropped, so no workflow is named.
export const generationProposeLayoutInput = projectScoped.extend({
  variantId: z.string().min(1),
  provider: z.string().min(1),
})
export type GenerationProposeLayoutInput = z.infer<typeof generationProposeLayoutInput>

export const generationCopyOptionsInput = projectScoped.extend({
  variantId: z.string().min(1),
  layerId: z.string().min(1),
  count: z.number().int().min(1).max(MAX_COPY_OPTIONS),
  provider: z.string().min(1),
})
export type GenerationCopyOptionsInput = z.infer<typeof generationCopyOptionsInput>

export const generationCutOutInput = projectScoped.extend({
  variantId: z.string().min(1),
  layerId: z.string().min(1),
  provider: z.string().min(1),
  licenceConfirmed,
})
export type GenerationCutOutInput = z.infer<typeof generationCutOutInput>

// P5-1: spec/links-and-sync.md, "Generative fill". runFill is a gate run command for agents.
export const generationRunFillInput = projectScoped
  .extend({ variantId: z.string().min(1), provider: z.string().min(1), licenceConfirmed })
  .strict()
export type GenerationRunFillInput = z.infer<typeof generationRunFillInput>

// The window sends it when its attached fill succeeds (A-131).
export const generationApplyFillInput = projectScoped.extend({ jobId: z.string().min(1) }).strict()
export type GenerationApplyFillInput = z.infer<typeof generationApplyFillInput>

export type GenerationRunFillReply = { jobId: string }
export type GenerationApplyFillReply = { variantIds: string[] }
