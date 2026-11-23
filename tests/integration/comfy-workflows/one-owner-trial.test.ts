import { describe, it, afterEach, vi } from 'vitest'
import { provesOneOwner, type OneOwner } from './one-owner-cases'

// [D-103] The shipped workflows are proven, so no custom one is ever a default on them. This
// file runs on a copy where each is a trial (tests/helpers/trial-workflows.ts): with the dev
// tools off no shipped one is offered, and the oldest custom one that fits is the default.
vi.mock('@/main/providers/comfyui/workflows', async (load) =>
  (await import('../../helpers/trial-workflows')).asTrial(await load()),
)

let o: OneOwner | undefined
afterEach(async () => {
  o?.f.cleanup()
  await o?.stand.close()
  o = undefined
})

describe('one owner of the rule, on the trial copy [D-104, CW-3]', () => {
  it.each([
    [true, 'user'],
    [false, 'user'],
    [true, 'agent'],
    [false, 'agent'],
  ] as const)('dev tools %s, %s: isDefault is what a run with no workflow named gets', async (devTools, actor) => {
    o = await provesOneOwner(devTools, actor)
  }, 30_000)
})
