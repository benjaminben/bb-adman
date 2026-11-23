import { describe, it, afterEach } from 'vitest'
import { provesOneOwner, type OneOwner } from './one-owner-cases'

let o: OneOwner | undefined
afterEach(async () => {
  o?.f.cleanup()
  await o?.stand.close()
  o = undefined
})

describe('one owner of the rule [D-104, CW-3]', () => {
  it.each([
    [true, 'user'],
    [false, 'user'],
    [true, 'agent'],
    [false, 'agent'],
  ] as const)('dev tools %s, %s: isDefault is what a run with no workflow named gets', async (devTools, actor) => {
    o = await provesOneOwner(devTools, actor)
  }, 30_000)
})
