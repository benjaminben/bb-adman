// spec/scene.md "One draw" step 3 and phase-08.md "Drawing at full size": the frame's transform.
// Without view the Scene is scaled to the asked width from its top-left corner; with view it is
// drawn at scale 1 and shifted by (-x, -y), so the window shows that one tile.
import type { RenderRequest } from '@/shared/schemas/render'

export function frameStyle({ input, width, view }: RenderRequest): { transform: string } {
  if (view) return { transform: `translate(${-view.x}px, ${-view.y}px)` }
  return { transform: `scale(${width / input.variant.width})` }
}
