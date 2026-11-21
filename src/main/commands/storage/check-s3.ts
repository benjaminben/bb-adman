// storage.checkS3 (spec/storage-and-publish.md "Test connection (S3)"): the user's "Test
// connection" for the saved bucket, region and keys. Security class. App-scope, agent policy
// deny, writes nothing to settings or the project. Order: the S3 settings check, the one
// NEEDS_KEY guard, then checkS3Access. A refusal is one fixed sentence; the provider's detail
// (both keys removed) goes to the local log only, with the step's name.
import { defineCommand, type HandlerResult } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { checkS3Access, type S3CheckOutcome } from '@/main/providers/s3/check-access'
import type { AdapterContext } from '@/main/providers/types'
import {
  s3CheckSentence,
  storageCheckS3Input,
  type StorageCheckS3Reply,
} from '@/shared/schemas/commands/storage-check'
import { AppError } from '@/shared/schemas/result'
import type { SecretName } from '@/shared/schemas/secrets'
import { requireS3Settings } from './require-s3-settings'

type Deps = Pick<CoreDeps, 'providers' | 'secrets' | 'settings' | 'log'>
export type S3Check = (ctx: AdapterContext) => Promise<S3CheckOutcome>

const S3_SECRETS: readonly SecretName[] = ['s3.accessKeyId', 's3.secretAccessKey']

// The keys and settings as an adapter sees them, read at the moment of the check. Only the
// two S3 keys can be read through it.
function contextOf(deps: Deps): AdapterContext {
  return {
    secret(name) {
      const known = S3_SECRETS.find((secret) => secret === name)
      const value = known === undefined ? undefined : deps.secrets.get(known)
      if (value === undefined) throw new Error(`Secret not saved: ${name}`)
      return value
    },
    settings: () => deps.settings.get(),
    model: () => 'none',
  }
}

export function storageCheckS3(deps: Deps, check: S3Check = (ctx) => checkS3Access(ctx)) {
  return defineCommand({
    name: 'storage.checkS3',
    input: storageCheckS3Input,
    async run(ctx): Promise<HandlerResult<StorageCheckS3Reply>> {
      requireS3Settings(deps)
      requireProviderKeys(deps, 's3', 'test the connection')
      const outcome = await check(contextOf(deps))
      if (outcome.ok) return { data: { ok: true } }
      deps.log.write({
        level: 'warn',
        event: 'provider',
        name: 'storage.checkS3',
        actor: ctx.actor,
        ok: false,
        errorKind: outcome.reason,
        message: outcome.detail,
        context: { commandId: ctx.commandId, provider: 's3' },
      })
      const { reason, permission } = outcome
      const details = permission === undefined ? { reason } : { reason, permission }
      throw new AppError('PROVIDER_ERROR', s3CheckSentence(outcome), details)
    },
  })
}
