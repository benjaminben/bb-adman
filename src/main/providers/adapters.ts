// SPEC 6: joins the provider folders by provider ID. Frozen contract (Phase 2 step 0).
// A slice that uses a provider calls adapterFor and imports no adapter folder.
import type { CoreDeps } from '../core-deps'
import { AppError } from '../../shared/schemas/result'
import { adapters as azureBlob } from './azure-blob'
import { adapters as dropbox } from './dropbox'
import { adapters as falSeedance } from './fal-seedance'
import { adapters as fake } from './fake'
import { adapters as gemini } from './gemini'
import { adapters as localStorage } from './local-storage'
import { adapters as s3 } from './s3'
import type { AdapterContext, AdapterJob, ProviderAdapters } from './types'

const FOLDERS: Record<string, ProviderAdapters> = {
  'azure-blob': azureBlob,
  dropbox,
  'fal-seedance': falSeedance,
  fake,
  gemini,
  'local-storage': localStorage,
  s3,
}

// The local folder is used by export and by tests; no user picks it, so it is not in the
// provider list (SPEC 6, 6.5).
const UNLISTED: Partial<Record<string, AdapterJob[]>> = { 'local-storage': ['storage'] }

type AdapterDeps = {
  providers: CoreDeps['providers']
  secrets: { get(name: string): string | undefined }
  settings: { get(): ReturnType<CoreDeps['settings']['get']> }
}

type Built<J extends AdapterJob> = ReturnType<NonNullable<ProviderAdapters[J]>>

function context(deps: AdapterDeps, providerId: string): AdapterContext {
  const info = deps.providers.find((p) => p.id === providerId)
  return {
    secret(name) {
      const value = deps.secrets.get(name)
      if (value === undefined) throw new Error(`Secret not saved: ${name}`)
      return value
    },
    settings: () => deps.settings.get(),
    model(job) {
      const model = info?.defaultModels[job]
      if (model === undefined) throw new Error(`No default model for ${providerId} ${job}`)
      return model
    },
  }
}

function doesJob(deps: AdapterDeps, providerId: string, job: AdapterJob): boolean {
  const info = deps.providers.find((p) => p.id === providerId)
  if (info) return info.jobs.includes(job)
  return UNLISTED[providerId]?.includes(job) ?? false
}

// The same as adapterFor over a given table of folders, so tests can supply adapters.
export function adapterFrom<J extends AdapterJob>(
  table: Record<string, ProviderAdapters>,
  deps: AdapterDeps,
  providerId: string,
  job: J,
): Built<J> {
  const build = doesJob(deps, providerId, job) ? table[providerId]?.[job] : undefined
  if (!build) {
    throw new AppError('INVALID_INPUT', 'That provider cannot do this yet.', {
      provider: providerId,
      job,
    })
  }
  return build(context(deps, providerId)) as Built<J>
}

export function adapterFor<J extends AdapterJob>(
  deps: AdapterDeps,
  providerId: string,
  job: J,
): Built<J> {
  return adapterFrom(FOLDERS, deps, providerId, job)
}
