// P10-1: ConnectInfo.claudeDesktop, null until P10-9. The subject.list stub rows were removed
// by P10-2, which built it (tests/integration/queries/subject-list.test.ts).
import { afterEach, describe, expect, it } from 'vitest'
import { data, makeFixture, type Fixture } from '../core-fixture'
import type { ConnectInfo } from '@/shared/schemas/queries/mcp'

let f: Fixture | undefined
afterEach(() => {
  f?.cleanup()
  f = undefined
})

async function open(): Promise<{ fx: Fixture; projectId: string }> {
  const fx = makeFixture()
  f = fx
  const made = await fx.user('project.create', { name: 'A', location: fx.projectsDir })
  return { fx, projectId: data<{ projectId: string }>(made).projectId }
}

describe('ConnectInfo.claudeDesktop [P10-1, A-245]', () => {
  it('is null until the bridge is built', async () => {
    const { fx } = await open()
    const info = data<ConnectInfo>(await fx.core.query('mcp.getConnectInfo', {}, { actor: 'user' }))
    expect(info.claudeDesktop).toBeNull()
  })
})
