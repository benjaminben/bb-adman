import { afterEach, describe, it, expect, vi } from 'vitest'
import { ProviderFailure } from '@/main/providers/types'
import { safely } from '../../live/live-output'

afterEach(() => vi.restoreAllMocks())

async function failWith(failure: unknown) {
  const printed: string[] = []
  vi.spyOn(process.stdout, 'write').mockImplementation((text) => {
    printed.push(String(text))
    return true
  })
  const thrown = await safely('Gemini', async () => {
    throw failure
  }).catch((error: unknown) => error as Error)
  return { printed: printed.join(''), thrown }
}

describe('a failed live call prints the detail once and throws a short error [SPEC 14 1.18 K6]', () => {
  it('prints the kind and detail lines, and throws an error naming the kind only', async () => {
    const failure = new ProviderFailure({ kind: 'offline', detail: 'made-up detail text' })
    const { printed, thrown } = await failWith(failure)
    expect(printed).toBe('Gemini error kind: offline\nGemini error detail: made-up detail text\n')
    expect(thrown.message).toBe('Gemini error offline')
    expect(thrown.cause).toBeUndefined()
  })

  it('throws a short error with no message for a failure that is not a ProviderFailure', async () => {
    const { printed, thrown } = await failWith(new Error('made-up message'))
    expect(printed).toBe('Gemini error: made-up message\n')
    expect(thrown.message).toBe('Gemini error')
    expect(thrown.cause).toBeUndefined()
  })
})
