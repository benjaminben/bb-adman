// The behaviour switches every fake part honours (spec/ai-jobs.md "The fake provider's
// parts"): fail, waitMs and onCancel. Each part's test file calls this once.
import { describe, it, expect, afterEach } from 'vitest'
import { resetFakeBehaviour, setFakeBehaviour } from '@/main/providers/fake/behaviour'
import { ProviderCancelled, ProviderFailure, type RunOptions } from '@/main/providers/types'

export function describeSwitches(part: string, call: (opts?: RunOptions) => Promise<unknown>) {
  describe(`fake provider, ${part}: the behaviour switches`, () => {
    afterEach(() => resetFakeBehaviour())

    it('fails with the kind it is told', async () => {
      setFakeBehaviour({ fail: 'quota' })
      const error = await call().catch((e: unknown) => e)
      expect(error).toBeInstanceOf(ProviderFailure)
      expect((error as ProviderFailure).error.kind).toBe('quota')
    })

    it('waits as long as it is told to', async () => {
      setFakeBehaviour({ waitMs: 60 })
      const start = Date.now()
      await call()
      expect(Date.now() - start).toBeGreaterThanOrEqual(50)
    })

    it.each([
      ['stop', 'cancelled'],
      ['finish', 'settled'],
      ['no_confirm', 'pending'],
    ] as const)('on cancel %s: the call is %s', async (onCancel, expected) => {
      setFakeBehaviour({ waitMs: 5_000, onCancel })
      const controller = new AbortController()
      const run = call({ signal: controller.signal })
      controller.abort()
      const outcome = await Promise.race([
        run.then(
          () => 'settled',
          (e: unknown) => (e instanceof ProviderCancelled ? 'cancelled' : 'other'),
        ),
        new Promise((r) => setTimeout(() => r('pending'), 50)),
      ])
      expect(outcome).toBe(expected)
    })
  })
}
