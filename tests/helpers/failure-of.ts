// The ProviderError a promise fails with. Fails the test when it does not fail that way.
import { ProviderFailure } from '../../src/main/providers/types'
import type { ProviderError } from '../../src/shared/schemas/queries/app'

export async function failureOf(promise: Promise<unknown>): Promise<ProviderError> {
  const error: unknown = await promise.then(
    () => undefined,
    (e: unknown) => e,
  )
  if (!(error instanceof ProviderFailure)) throw new Error('Expected a ProviderFailure')
  return error.error
}
