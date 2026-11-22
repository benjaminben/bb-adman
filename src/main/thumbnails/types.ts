// spec/scene.md, "One draw" and "The render service". No Electron: core imports these.
import type { BusEvent, CommandBus } from '@/main/commands/bus'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import type { SceneInput } from '@/shared/scene/types'
import type { ThumbnailGet, VariantRender } from '@/shared/schemas/queries/render'

export type DrawResult = { png: Uint8Array; overflow: Record<string, boolean> }

// The Electron side of one draw (src/main/render/draw.ts); index.ts passes it to createCore.
// view (P8-3): one tile of a big variant, drawn at scale 1 shifted by (-x, -y); size is the
// tile's.
export type DrawScene = (
  input: SceneInput,
  size: { width: number; height: number },
  view?: { x: number; y: number },
) => Promise<DrawResult>

export type RenderService = {
  thumbnail(project: ProjectHandle, variantId: string): Promise<ThumbnailGet>
  // timeMs: the time a video variant is drawn at (P7-7); left out, 0.
  render(
    project: ProjectHandle,
    variantId: string,
    maxDimension: number,
    timeMs?: number,
  ): Promise<VariantRender>
  // P10-3 (A-234): the agent's picture, the complete variant as the user sees it. It reports
  // no overflow, sends no event and keeps no file: an agent's look changes nothing.
  renderForAgent(
    project: ProjectHandle,
    variantId: string,
    maxDimension: number,
    timeMs?: number,
  ): Promise<VariantRender>
  // The variant with its text layers left out, for the layout job (spec/ai-jobs.md). It
  // reports no overflow and keeps no file.
  renderPictures(
    project: ProjectHandle,
    variantId: string,
    maxDimension: number,
  ): Promise<VariantRender>
  // P8-4: a PNG of exactly the variant's pixel size, drawn in tiles of at most 2,048 a side.
  // One queue item at render priority; no layer.reportOverflow and no file kept.
  drawFull(input: SceneInput): Promise<Uint8Array>
  // Sees every event the main process sends.
  onEvent(event: BusEvent): void
  // Called by project.close after the file closes.
  projectClosed(projectId: string): Promise<void>
}

// Read late: core.ts builds CoreDeps and the bus after the service, as for the job runner.
export type RenderServiceOptions = {
  deps: () => CoreDeps
  bus: () => CommandBus
  emit: (event: BusEvent) => void
  draw: DrawScene
}
