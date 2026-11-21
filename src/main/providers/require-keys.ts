// The NEEDS_KEY guard (SPEC 4.1, FR-171). Every command or job about to call a provider
// calls it first. No other code decides that a key is missing.
import type { CoreDeps } from '@/main/core-deps'
import { AppError } from '@/shared/schemas/result'

export function requireProviderKeys(
  deps: Pick<CoreDeps, 'providers' | 'secrets'>,
  providerId: string,
  purpose: string,
): void {
  const provider = deps.providers.find((p) => p.id === providerId)
  if (!provider) throw new Error(`Unknown provider: ${providerId}`)
  const missing = provider.secrets.some((name) => deps.secrets.get(name) === undefined)
  if (missing) {
    throw new AppError('NEEDS_KEY', `Add your ${provider.label} key to ${purpose}.`, {
      provider: providerId,
    })
  }
}
