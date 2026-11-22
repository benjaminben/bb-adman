// dev.storage (SPEC 4.2 [1.8], [1.21] notes; Section 14 slice I): the hand-test command for
// storage. Actions: write, list, remove; there is no read action. For s3 and dropbox it calls
// the key guard, then checks the S3 settings (storage_not_set_up), then the StorageProvider,
// and touches only adman-hand-test/ there. `local` needs no key and skips the guard; its root
// is {userData}/hand-test-local, set here by main-process code (no input names a root), and
// before every local action the root and its hand-test folder are refused when either is a
// link or not a folder (storage_folder_unsafe). `write` reads the path it is sent, up to
// HAND_TEST_MAX_UPLOAD_BYTES. Denied to agents (agent-policy.ts). Not a product feature.
import fs from 'node:fs/promises'
import nodePath from 'node:path'
import { defineCommand } from '@/main/commands/types'
import type { CoreDeps } from '@/main/core-deps'
import { devStorageInput, type DevStorageInput } from '@/shared/schemas/commands/dev'
import { AppError } from '@/shared/schemas/result'
import { HAND_TEST_MAX_UPLOAD_BYTES } from '@/shared/config/dev-tools'
import type { LogActor } from '@/main/log/activity-log'
import { adapterFor } from '@/main/providers/adapters'
import { localStorageAt } from '@/main/providers/local-storage'
import { requireProviderKeys } from '@/main/providers/require-keys'
import { requireS3Settings } from '@/main/commands/storage/require-s3-settings'
import { ProviderFailure, type StorageProvider } from '@/main/providers/types'
import { listHandTest, removeHandTest, writeHandTest } from './hand-test-storage'
import { checkLocalRoot, handTestLocalRoot } from './local-root'
import { storageError, type StorageLabel } from './storage-error'

type Target = DevStorageInput['storage']
type Deps = Pick<
  CoreDeps,
  'providers' | 'secrets' | 'settings' | 'userDataDir' | 'log' | 'dropboxFetch'
>
type Ctx = { actor: LogActor; commandId: string }
export type OpenStorage = (target: Target) => StorageProvider

const LOCAL: StorageLabel = { id: 'local', label: 'Local storage' }

function labelOf(deps: Deps, target: Target): StorageLabel {
  if (target === 'local') return LOCAL
  return { id: target, label: deps.providers.find((p) => p.id === target)?.label ?? target }
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

// [1.21] F-04: a file error other than "not there" is the state of the computer, not the
// input. Its code goes to the log as a warn line; no path goes anywhere.
function fileError(deps: Deps, ctx: Ctx, error: NodeJS.ErrnoException): AppError {
  if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
    return new AppError('NOT_FOUND', 'That file was not found.')
  }
  deps.log.write({
    level: 'warn',
    event: 'command',
    name: 'dev.storage',
    actor: ctx.actor,
    ok: false,
    errorKind: error.code ?? 'unknown',
    message: 'The picked file could not be read',
    context: { commandId: ctx.commandId },
  })
  return new AppError('RULE_VIOLATION', 'That file could not be read.', {
    reason: 'file_not_readable',
  })
}

// The picked file's name and bytes. The path must be absolute, name a file and be no larger
// than `limit` bytes, checked from its stat size before it is read.
async function pickedFile(deps: Deps, ctx: Ctx, filePath: string, limit: number) {
  if (!nodePath.isAbsolute(filePath)) {
    throw new AppError('INVALID_INPUT', 'Choose a file by its full path.')
  }
  const failed = (error: NodeJS.ErrnoException): never => {
    throw fileError(deps, ctx, error)
  }
  const stats = await fs.stat(filePath).catch(failed)
  if (!stats.isFile()) throw new AppError('INVALID_INPUT', 'Choose a file, not a folder.')
  if (stats.size > limit) throw new AppError('INVALID_INPUT', 'Choose a file smaller than 100 MB.')
  const bytes = new Uint8Array(await fs.readFile(filePath).catch(failed))
  return { name: nodePath.basename(filePath), bytes }
}

type Picked = (filePath: string) => Promise<{ name: string; bytes: Uint8Array }>

async function act(storage: () => StorageProvider, input: DevStorageInput, picked: Picked) {
  if (input.action === 'list') return { names: await listHandTest(storage()) }
  if (input.action === 'remove') return { removed: await removeHandTest(storage()) }
  const { name, bytes } = await picked(input.filePath ?? '')
  await writeHandTest(storage(), name, bytes)
  return { name, size: bytes.length }
}

export function devStorage(
  deps: Deps,
  open: OpenStorage = openHandTestStorage(deps),
  limit = HAND_TEST_MAX_UPLOAD_BYTES,
) {
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
        const picked: Picked = (filePath) => pickedFile(deps, ctx, filePath, limit)
        return { data: await act(() => open(input.storage), input, picked) }
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
