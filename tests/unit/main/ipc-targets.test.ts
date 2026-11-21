import { describe, it, expectTypeOf } from 'vitest'
import type { IpcTargets } from '../../../src/main/ipc'

describe('IpcTargets [SPEC 4.2 notes, step 0 fix F5]', () => {
  it('requires isInternal, with no default', () => {
    expectTypeOf<IpcTargets['isInternal']>().toEqualTypeOf<(name: string) => boolean>()
  })
})
