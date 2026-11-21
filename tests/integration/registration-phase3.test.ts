// P3-0: the Phase 3 domains are registered empty, the render service is on CoreDeps, and
// project.close tells it a project closed (spec/scene.md, "The render service").
import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeFixture, data, type Fixture } from './core-fixture'
import { layerCommands } from '@/main/commands/layer'
import { variantCommands } from '@/main/commands/variant'
import { variantQueries } from '@/main/queries/variant'
import { renderQueries } from '@/main/queries/render'

let f: Fixture
afterEach(() => f.cleanup())

describe('Phase 3 domains are registered empty [spec/structure.md, P3-0]', () => {
  it('gives an empty handler list for layer and variant, and an empty query map for variant and render', () => {
    f = makeFixture()
    const deps = f.core.deps
    expect(layerCommands(deps)).toEqual([])
    expect(variantCommands(deps)).toEqual([])
    expect(variantQueries(deps)).toEqual({})
    expect(renderQueries(deps)).toEqual({})
  })

  it('puts the render service on CoreDeps', () => {
    f = makeFixture()
    for (const name of ['thumbnail', 'render', 'onEvent', 'projectClosed'] as const) {
      expect(typeof f.core.deps.render[name]).toBe('function')
    }
  })
})

describe('project.close and the render service [spec/scene.md, The render service]', () => {
  it('calls projectClosed with the project ID after the file closes', async () => {
    f = makeFixture()
    const closed = vi.spyOn(f.core.deps.render, 'projectClosed')
    const p = data<{ projectId: string }>(
      await f.user('project.create', { name: 'A', location: f.projectsDir }),
    )
    expect(closed).not.toHaveBeenCalled()
    expect((await f.user('project.close', { projectId: p.projectId })).ok).toBe(true)
    expect(closed).toHaveBeenCalledWith(p.projectId)
    expect(f.core.projects.get(p.projectId)).toBeUndefined()
  })

  it('does not call projectClosed when the project is not open', async () => {
    f = makeFixture()
    const closed = vi.spyOn(f.core.deps.render, 'projectClosed')
    await f.user('project.close', { projectId: '01ABC' })
    expect(closed).not.toHaveBeenCalled()
  })
})
