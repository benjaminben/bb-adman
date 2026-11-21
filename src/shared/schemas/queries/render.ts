// spec/editor-commands.md, "thumbnail.get" and "variant.render".
import { z } from 'zod'
import { projectScoped } from '@/shared/schemas/commands/project-scoped'
import { RENDER_LIMITS } from '@/shared/config/render'

export const thumbnailGetInput = projectScoped.extend({ variantId: z.string().min(1) })
export type ThumbnailGetInput = z.infer<typeof thumbnailGetInput>

export type ThumbnailGet =
  | { state: 'ready'; rev: number; png: Uint8Array }
  | { state: 'pending'; rev: number }
  | { state: 'failed'; rev: number }

export const variantRenderInput = projectScoped.extend({
  variantId: z.string().min(1),
  maxDimension: z.number().int().min(64).max(RENDER_LIMITS.maxDimension).default(1024),
  // P7-7: the time to draw a video variant at; an image variant ignores it.
  timeMs: z.number().int().min(0).default(0),
})
export type VariantRenderInput = z.infer<typeof variantRenderInput>

// The variant drawn now, its longer side maxDimension (never larger than the variant itself).
export type VariantRender = { png: Uint8Array; width: number; height: number; rev: number }
