// dev.storage (SPEC 4.2 [1.8], Section 14 slice I): the hand-test command for storage. It calls
// the key guard, then the chosen StorageProvider, and touches only adman-hand-test/ there.
// `local` is the app data folder, set here by main-process code (SPEC 6.5 [1.13]); no input
// names a root. Denied to agents (agent-policy.ts). Not a product feature.
import fs from 'node:fs/promises'
import nodePath from 'node:path'
import { defineCommand } from '../types'
import type { CoreDeps } from '../../core-deps'
import { devStorageInput, type DevStorageInput } from '../../../shared/schemas/commands/dev'
import { AppError } from '../../../shared/schemas/result'
import { adapterFor } from '../../providers/adapters'
import { localStorageAt } from '../../providers/local-storage'
import { requireProviderKeys } from '../../providers/require-keys'
import { ProviderFailure, type StorageProvider } from '../../providers/types'
import { listHandTest, removeHandTest, writeHandTest } from './hand-test-storage'
import { checkLocalRoot, handTestLocalRoot } from './local-root'
import { storageError, type StorageLabel } from './storage-error'

type Target = DevStorageInput['storage']
type Deps = Pick<CoreDeps, 'providers' | 'secrets' | 'settings' | 'userDataDir' | 'log'>
export type OpenStorage = (target: Target) => StorageProvider

const LOCAL: StorageLabel = { id: 'local', label: 'Local storage' }

function labelOf(deps: Deps, target: Target): StorageLabel {
  if (target === 'local') return LOCAL
  return { id: target, label: deps.providers.find((p) => p.id === target)?.label ?? target }
}

// [1.21] F-02: S3 with no settings saved or an empty bucket, before the adapter is reached.
function requireS3Settings(deps: Deps): void {
  const s3 = deps.settings.get().storage.s3
  if (s3 === null || s3.bucket === '') {
    throw new AppError(
      'RULE_VIOLATION',
      'Amazon S3 is not set up yet. Enter a bucket and a region, then try again.',
      { reason: 'storage_not_set_up', provider: 's3' },
    )
  }
}

// The real storages: {userData}/hand-test-local for `local`, the provider's adapter otherwise.
// Opened after the key guard.
export function openHandTestStorage(deps: Deps): OpenStorage {
  return (target) => {
    if (target === 'local') return localStorageAt(handTestLocalRoot(deps.userDataDir))
    if (target === 's3') requireS3Settings(deps)
    return adapterFor(deps, target, 'storage')
  }
}

// The picked file's name and bytes. The path must be absolute and name a file.
async function pickedFile(filePath: string): Promise<{ name: string; bytes: Uint8Array }> {
  if (!nodePath.isAbsolute(filePath)) {
    throw new AppError('INVALID_INPUT', 'Choose a file by its full path.')
  }
  const stats = await fs.stat(filePath).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      throw new AppError('NOT_FOUND', 'That file was not found.')
    }
    throw error
  })
  if (!stats.isFile()) throw new AppError('INVALID_INPUT', 'Choose a file, not a folder.')
  return { name: nodePath.basename(filePath), bytes: new Uint8Array(await fs.readFile(filePath)) }
}

async function act(storage: () => StorageProvider, input: DevStorageInput) {
  if (input.action === 'list') return { names: await listHandTest(storage()) }
  if (input.action === 'remove') return { removed: await removeHandTest(storage()) }
  const { name, bytes } = await pickedFile(input.filePath ?? '')
  await writeHandTest(storage(), name, bytes)
  return { name, size: bytes.length }
}

export function devStorage(deps: Deps, open: OpenStorage = openHandTestStorage(deps)) {
  return defineCommand({
    name: 'dev.storage',
    input: devStorageInput,
    async run(ctx, input) {
      const label = labelOf(deps, input.storage)
      if (input.storage !== 'local') {
        requireProviderKeys(deps, input.storage, 'use the hand-test tools')
      }
      try {
        if (input.storage === 'local') await checkLocalRoot(handTestLocalRoot(deps.userDataDir))
        return { data: await act(() => open(input.storage), input) }
      } catch (error) {
        if (error instanceof ProviderFailure) {
          // The raw detail is for the local log only (SPEC 6.5 [1.14] F-04).
          deps.log.write({
            level: 'warn',
            event: 'provider',
            name: 'dev.storage',
            actor: ctx.actor,
            ok: false,
            errorKind: error.error.kind,
            message: error.error.detail,
            context: { commandId: ctx.commandId, provider: label.id },
          })
        }
        throw storageError(error, label)
      }
    },
  })
}
