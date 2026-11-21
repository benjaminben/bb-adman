import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, data, type Fixture } from '../core-fixture'

let f: Fixture
afterEach(() => f.cleanup())

describe('asset.checkChanged in the app core [SPEC 14, Slice A rulings point 2b, A3-4]', () => {
  it('is internal, so a window cannot send it, and an agent is denied', async () => {
    f = makeFixture()
    const { projectId } = data<{ projectId: string }>(
      await f.user('project.create', { name: 'P', location: f.projectsDir }),
    )
    expect(f.core.isInternal('asset.checkChanged')).toBe(true)
    const byAgent = await f.core.bus.execute(
      'asset.checkChanged',
      { projectId },
      { actor: 'agent' },
    )
    expect(byAgent).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
    expect(await f.user('asset.checkChanged', { projectId })).toEqual({
      ok: true,
      data: { assetIds: [] },
    })
  })
})
