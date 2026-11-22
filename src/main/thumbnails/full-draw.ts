// spec/phases/phase-08.md, "Drawing at full size" [A-190, A-191]: RenderService.drawFull. A
// PNG of exactly the variant's pixel size, as one queue item at render priority. A variant over
// the render window's limit is drawn in tiles at scale 1 and stitched here. It sends no
// layer.reportOverflow and keeps no file: an export draw changes nothing in the project.
import { RENDER_LIMITS } from '@/shared/config/render'
import type { ExportPictures } from '@/main/export/types'
import type { SceneInput } from '@/shared/scene/types'
import type { DrawQueue } from './queue'
import { tilePlan } from './tiles'
import type { DrawScene } from './types'

export function drawFullWith(
  queue: DrawQueue,
  draw: DrawScene,
  pictures: () => ExportPictures,
): (input: SceneInput) => Promise<Uint8Array> {
  async function drawAll(input: SceneInput): Promise<Uint8Array> {
    const size = { width: input.variant.width, height: input.variant.height }
    const tiles = tilePlan(size.width, size.height, RENDER_LIMITS.maxDimension)
    if (tiles.length === 1) return (await draw(input, size)).png
    const parts = []
    for (const t of tiles) {
      const { png } = await draw(input, { width: t.width, height: t.height }, { x: t.x, y: t.y })
      parts.push({ x: t.x, y: t.y, png })
    }
    return pictures().stitch(parts, size)
  }

  return (input) => queue.render(() => drawAll(input))
}
