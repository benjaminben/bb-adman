// S2-5: the items a failed ComfyUI run's server lacked, read from the row's `result.missing`.
// Each entry is checked against the MissingItem shape; one that fails is left out.
// [CW-7] A custom workflow's row has an empty list and `result.missingCount`.
import { z } from 'zod'
import type { MissingItem } from '@/shared/schemas/queries/app'

const missingItem = z.object({
  what: z.enum(['model', 'node', 'version', 'add_on']),
  name: z.string(),
  folder: z.string().optional(),
}) satisfies z.ZodType<MissingItem>

const withList = z.object({ missing: z.array(z.unknown()) })

const withCount = z.object({ missingCount: z.number().int().positive() })

// D-104 (CW-7): a custom workflow's row holds only how many items the server lacks.
export function missingCount(result: unknown): number | undefined {
  const parsed = withCount.safeParse(result)
  return parsed.success ? parsed.data.missingCount : undefined
}

export function missingItems(result: unknown): MissingItem[] {
  const parsed = withList.safeParse(result)
  if (!parsed.success) return []
  return parsed.data.missing.flatMap((entry) => {
    const item = missingItem.safeParse(entry)
    return item.success ? [item.data] : []
  })
}
