// spec/scene.md, "One draw": the two messages between the main process and the render window.
// The main process checks every RenderDone with this schema before it takes it.
import { z } from 'zod'
import { RENDER_LIMITS } from '@/shared/config/render'
import { LayerRow } from '@/shared/schemas/rows/layer'
import type { SceneInput } from '@/shared/scene/types'

export const RENDER_CHANNELS = {
  request: 'adman:render-request',
  done: 'adman:render-done',
} as const

const side = z.number().int().min(1).max(RENDER_LIMITS.maxDimension)

const SceneInputSchema: z.ZodType<SceneInput> = z
  .object({
    projectId: z.string().min(1),
    variant: z
      .object({
        width: z.number().positive(),
        height: z.number().positive(),
        language: z.string(),
        format: z.enum(['image', 'video']),
        durationMs: z.number().min(0),
      })
      .strict(),
    layers: z.array(LayerRow),
    assets: z.record(
      z.string(),
      z
        .object({
          kind: z.enum(['image', 'font']),
          missing: z.boolean(),
          width: z.number().int().nullable(),
          height: z.number().int().nullable(),
        })
        .strict(),
    ),
    timeMs: z.number().min(0),
    mode: z.enum(['full', 'overlay-only']),
  })
  .strict()

export const RenderRequest = z
  .object({ requestId: z.string().min(1), input: SceneInputSchema, width: side, height: side })
  .strict()
export type RenderRequest = z.infer<typeof RenderRequest>

export const RenderDone = z
  .object({ requestId: z.string().min(1), overflow: z.record(z.string(), z.boolean()) })
  .strict()
export type RenderDone = z.infer<typeof RenderDone>
