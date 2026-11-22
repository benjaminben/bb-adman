// The video_generation job's shapes (SPEC 6.10.7, 14 1.41 CU-6a): what generation.startVideo
// stores in job.request, and what the job returns in job.result. Shared, so the window can
// read them; this file imports nothing from the main process.
import { z } from 'zod'
import { referenceIds } from '@/shared/schemas/reference-ids'

export const videoJobRequest = z.object({
  prompt: z.string().min(1),
  durationMs: z.number().int().positive(),
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  start: z.enum(['none', 'first_frame', 'background']),
  referenceAssetIds: referenceIds,
})

// The stored clip's asset and what checkMp4 read from it. [1.39] hasSound. OI-36 default:
// `details: 'pending'` marks a clip whose file holds no details of the app yet (Phase 7).
// P7-11: 'embedded' once they are written in; clipId is the clip put on the track, optional
// so rows made before Phase 7 parse.
export const videoJobResult = z.object({
  assetId: z.string(),
  width: z.number().int(),
  height: z.number().int(),
  durationMs: z.number().int(),
  hasSound: z.boolean(),
  details: z.enum(['embedded', 'pending']),
  clipId: z.string().nullable().optional(),
})

export type VideoJobRequest = z.infer<typeof videoJobRequest>
export type VideoJobResult = z.infer<typeof videoJobResult>
