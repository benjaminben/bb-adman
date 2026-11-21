import { z } from 'zod'

// SPEC 3.3 direction, in wire form (SPEC 4.4).
export const DirectionRow = z.object({
  id: z.string(),
  campaignId: z.string(),
  name: z.string(),
  masterVariantId: z.string(),
  sort: z.number().int(),
})
export type DirectionRow = z.infer<typeof DirectionRow>
