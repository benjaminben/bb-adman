// The layout_proposal job's shapes (spec/ai-jobs.md "Contracts", "Layout proposal"). Shared, so
// the window can read them; this file imports nothing from the main process.
import { z } from 'zod'

// The job reads the variant when it runs, so the request holds nothing.
export const layoutJobRequest = z.object({}).strict()

// One box per text layer, in the variant's own pixels, after clampLayout. `slot` is the text
// layer's key. A null colour leaves the layer's own.
export const layoutBox = z.object({
  slot: z.string(),
  x: z.number().int(),
  y: z.number().int(),
  width: z.number().int(),
  height: z.number().int(),
  fontSize: z.number().int(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable(),
  align: z.enum(['left', 'center', 'right']),
})

export const layoutJobResult = z.object({ boxes: z.array(layoutBox) })

export type LayoutJobRequest = z.infer<typeof layoutJobRequest>
export type LayoutJobBox = z.infer<typeof layoutBox>
export type LayoutJobResult = z.infer<typeof layoutJobResult>
