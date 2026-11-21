import { afterEach, describe, it, expect, vi } from 'vitest'
import { ProviderFailure } from '../../../src/main/providers/types'
import { quietly } from '../../live/live-output'

afterEach(() => vi.restoreAllMocks())

describe('a live S3 call prints nothing for a failure the case expects [SPEC 6.5 1.16 A-07, H20]', () => {
  it('prints nothing and throws the safe error, so only an unexpected failure is shown', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true)
    const failure = new ProviderFailure({ kind: 'other', detail: 'in made-up-bucket' })
    const thrown = await quietly(
      'S3',
      async () => {
        throw failure
      },
      ['made-up-bucket'],
    ).catch((error: unknown) => error)
    expect(write).not.toHaveBeenCalled()
    expect((thrown as Error).message).toBe('S3 error other: in [key removed]')
    expect((thrown as Error).cause).toBeUndefined()
  })

  it('passes a result through unchanged', async () => {
    expect(await quietly('S3', async () => 7, [])).toBe(7)
  })
})
