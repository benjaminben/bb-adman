// P3-0 pinned the stand-in; P3-7 replaced its body with the real render service. These cases
// cover what needs no project file. The rest is in tests/integration/thumbnails/.
import { describe, it, expect, vi } from 'vitest'
import { createRenderService } from '@/main/thumbnails/service'
import type { CoreDeps } from '@/main/core-deps'
import type { CommandBus } from '@/main/commands/bus'

function build(deps: () => CoreDeps) {
  const emit = vi.fn()
  const draw = vi.fn()
  const service = createRenderService({ deps, bus: () => ({}) as CommandBus, emit, draw })
  return { service, emit, draw }
}

const noProjects = { projects: { get: () => undefined }, userDataDir: '/nowhere' }

describe('render service [spec/scene.md, The render service; P3-7]', () => {
  it('does nothing on an event of a project that is not open, or on a closed project', async () => {
    const { service, emit, draw } = build(() => noProjects as unknown as CoreDeps)
    service.onEvent({ name: 'app.stateChanged', payload: {} })
    service.onEvent({
      name: 'asset.changedOnDisk',
      payload: { projectId: '01HZY3V7Q8R9S0T1V2W3X4Y5Z6', assetIds: ['a'] },
    })
    await service.projectClosed('01HZY3V7Q8R9S0T1V2W3X4Y5Z6')
    expect(emit).not.toHaveBeenCalled()
    expect(draw).not.toHaveBeenCalled()
  })
})
