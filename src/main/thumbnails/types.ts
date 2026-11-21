// spec/scene.md, "One draw" and "The render service". No Electron: core imports these.
import type { BusEvent, CommandBus } from '@/main/commands/bus'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import type { SceneInput } from '@/shared/scene/types'
import type { ThumbnailGet, VariantRender } from '@/shared/schemas/queries/render'

export type DrawResult = { png: Uint8Array; overflow: Record<string, boolean> }

// The Electron side of one draw (src/main/render/draw.ts); index.ts passes it to createCore.
export type DrawScene = (
  input: SceneInput,
  size: { width: number; height: number },
) => Promise<DrawResult>

export type RenderService = {
  thumbnail(project: ProjectHandle, variantId: string): Promise<ThumbnailGet>
  render(project: ProjectHandle, variantId: string, maxDimension: number): Promise<VariantRender>
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
