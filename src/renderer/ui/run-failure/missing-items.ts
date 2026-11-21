// S2-5: the items a failed ComfyUI run's server lacked, read from the row's `result.missing`.
// Each entry is checked against the MissingItem shape; one that fails is left out.
import { z } from 'zod'
import type { MissingItem } from '@/shared/schemas/queries/app'

const missingItem = z.object({
  what: z.enum(['model', 'node', 'version', 'add_on']),
  name: z.string(),
  folder: z.string().optional(),
}) satisfies z.ZodType<MissingItem>

const withList = z.object({ missing: z.array(z.unknown()) })

export function missingItems(result: unknown): MissingItem[] {
  const parsed = withList.safeParse(result)
  if (!parsed.success) return []
  return parsed.data.missing.flatMap((entry) => {
    const item = missingItem.safeParse(entry)
    return item.success ? [item.data] : []
  })
}
