import { z } from 'zod'
import { JOB_KINDS, JOB_STATUSES } from '../../config/job-kinds'
import { PROVIDER_ERROR_KINDS } from '../queries/app'

// SPEC 3.3 job, in wire form (SPEC 4.4). Frozen contract between slices D and I.
// error_detail is a main-only column: it is never in the wire row (rows.ts).
export const JobRow = z.object({
  id: z.string(),
  kind: z.enum(JOB_KINDS),
  status: z.enum(JOB_STATUSES),
  campaignId: z.string().nullable(),
  variantId: z.string().nullable(),
  layerId: z.string().nullable(),
  slot: z.string().nullable(),
  provider: z.string().nullable(),
  model: z.string().nullable(),
  request: z.unknown(),
  remoteJobId: z.string().nullable(),
  result: z.unknown(),
  errorKind: z.enum(PROVIDER_ERROR_KINDS).nullable(),
  progress: z.number().nullable(),
  paidCalls: z.number().int().min(0),
  seenAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type JobRow = z.infer<typeof JobRow>
