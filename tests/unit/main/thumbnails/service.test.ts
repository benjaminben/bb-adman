// P3-0: the render service is a stand-in until P3-7. It draws nothing, writes nothing and
// sends nothing.
import { describe, it, expect, vi } from 'vitest'
import { createRenderService } from '@/main/thumbnails/service'
import type { CoreDeps } from '@/main/core-deps'
import type { CommandBus } from '@/main/commands/bus'
import type { ProjectHandle } from '@/main/db/project-file'

function build() {
  const emit = vi.fn()
  const draw = vi.fn()
  const service = createRenderService({
    deps: () => ({}) as CoreDeps,
    bus: () => ({}) as CommandBus,
    emit,
    draw,
  })
  return { service, emit, draw }
}

const project = { projectId: 'p1' } as ProjectHandle

describe('render service stand-in [spec/scene.md, The render service; P3-0]', () => {
  it('answers failed for a thumbnail', async () => {
    const { service } = build()
    expect(await service.thumbnail(project, 'v1')).toEqual({ state: 'failed', rev: 0 })
  })

  it('refuses to render', async () => {
    const { service } = build()
    await expect(service.render(project, 'v1', 1024)).rejects.toThrow('render is not available')
  })

  it('does nothing on an event or a closed project', async () => {
    const { service, emit, draw } = build()
    service.onEvent({ name: 'app.stateChanged', payload: {} })
    await service.projectClosed('p1')
    expect(emit).not.toHaveBeenCalled()
    expect(draw).not.toHaveBeenCalled()
  })
})
