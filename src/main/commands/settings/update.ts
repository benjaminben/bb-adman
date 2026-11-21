// settings.update (SPEC 4.2, 13.1; FR-004, FR-067, FR-170).
import path from 'node:path'
import { defineCommand } from '../types'
import type { CoreDeps } from '../../core-deps'
import { settingsPatchSchema, type SettingsPatch } from '../../../shared/schemas/settings'
import type { ProviderInfo } from '../../../shared/schemas/queries/app'
import { AppError } from '../../../shared/schemas/result'
import { regionRefusal } from '../../providers/s3/pinned-host'

function checkProviders(patch: SettingsPatch, providers: ProviderInfo[]): void {
  for (const [job, id] of Object.entries(patch.defaultProviders ?? {})) {
    const provider = providers.find((p) => p.id === id)
    const fits = provider?.available && provider.jobs.some((j) => j === job)
    if (!fits) {
      throw new AppError('INVALID_INPUT', `That provider cannot be the default for ${job}.`, {
        job,
        id,
      })
    }
  }
}

// SPEC 14 1.39 "S3" [FR-308]: a region this build does not support is refused when it is saved.
function checkS3Region(patch: SettingsPatch): void {
  const region = patch.storage?.s3?.region
  const refusal = region === undefined ? null : regionRefusal(region)
  if (refusal) throw new AppError('INVALID_INPUT', refusal, { reason: 'storage_not_supported' })
}

export function settingsUpdate(deps: Pick<CoreDeps, 'settings' | 'providers'>) {
  return defineCommand({
    name: 'settings.update',
    input: settingsPatchSchema,
    changesAppState: true,
    run(_ctx, patch) {
      if (patch.defaultProjectDir !== undefined && !path.isAbsolute(patch.defaultProjectDir)) {
        throw new AppError('INVALID_INPUT', 'Choose a folder for new projects.')
      }
      checkProviders(patch, deps.providers)
      checkS3Region(patch)
      return { data: deps.settings.update(patch) }
    },
  })
}
