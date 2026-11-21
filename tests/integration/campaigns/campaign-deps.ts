// Test helper for slice C: the CoreDeps fields its handlers read, with a fixed clock.
// Not a test file itself.
import type { CoreDeps } from '../../../src/main/core-deps'

export const TEST_NOW = '2026-11-20T10:00:00.000Z'

export function testDeps(over: Partial<CoreDeps> = {}): CoreDeps {
  const unused = () => {
    throw new Error('Not used by slice C tests.')
  }
  const base = { now: () => new Date(TEST_NOW) } as Partial<CoreDeps>
  return new Proxy({ ...base, ...over } as CoreDeps, {
    get: (target, key: string) => (key in target ? target[key as keyof CoreDeps] : unused),
  })
}
