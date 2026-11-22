// The layout_proposal job's shapes (spec/ai-jobs.md "Contracts", "Layout proposal"). Shared, so
// the window can read them; this file imports nothing from the main process.
import { z } from 'zod'
import { TYPE_STYLE_IDS, type TypeStyleId } from '@/shared/config/type-styles'

// The job reads the variant when it runs, so the request holds nothing.
export const layoutJobRequest = z.object({}).strict()

// One box per text layer, in the variant's own pixels, after clampLayout. `slot` is the text
// layer's key. A null colour leaves the layer's own. R2E-2 (spec/phases/round-2-editor.md D2):
// `readable` says what the contrast check did; `boxColor` and `boxPadding` are set only when it
// added a text box. All three are optional, so a result stored before them still parses. R2E-3
// (D3): `typeStyle` is one of the built-in styles, or null; set only when the job offered them.
export const LAYOUT_READABLE = ['kept', 'colour', 'box'] as const

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
  boxColor: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .optional(),
  boxPadding: z.number().int().min(0).optional(),
  readable: z.enum(LAYOUT_READABLE).optional(),
  typeStyle: z
    .enum(TYPE_STYLE_IDS as [TypeStyleId, ...TypeStyleId[]])
    .nullable()
    .optional(),
})

export const layoutJobResult = z.object({ boxes: z.array(layoutBox) })

export type LayoutJobRequest = z.infer<typeof layoutJobRequest>
export type LayoutJobBox = z.infer<typeof layoutBox>
export type LayoutJobResult = z.infer<typeof layoutJobResult>
