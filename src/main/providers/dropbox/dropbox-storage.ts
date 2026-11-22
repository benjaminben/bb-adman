// StorageProvider on the user's Dropbox app folder (spec/storage-and-publish.md "Dropbox",
// spec/phases/phase-09.md "Dropbox hosts and calls", security class full). Every path is
// /{rootPath}/{path}, or /{path} with an empty rootPath, and the root and each path are checked
// part by part before a request is built, so nothing outside the root is written, listed or
// removed. Endpoints are fixed strings; no value from a project or a setting picks an endpoint
// or a header. The content host takes its argument in the Dropbox-API-Arg header, as ASCII JSON.
// The access token comes from access-token.ts; after a 401 it is forgotten, renewed once and
// the request sent once more (every body here is bytes in memory, so it can be sent again).
// Every failure is one ProviderFailure through thrownFailure, with both tokens redacted.
import { z } from 'zod'
import { refusePath, storageFilePath, storageListPrefix } from '@/main/providers/storage-paths'
import { ProviderFailure, type AdapterContext, type StorageProvider } from '@/main/providers/types'
import { accessTokenFor, forgetDropboxAccess } from './access-token'
import { MAX_JSON_ANSWER_BYTES, readAnswer, UNREADABLE } from './answer'
import { answerFailure, errorTags, thrownFailure } from './failure'
import { DROPBOX_API_ORIGIN, DROPBOX_CONTENT_ORIGIN } from './hosts'
import { listFiles } from './list'
import { upload } from './upload'

const RPC = {
  getMetadata: `${DROPBOX_API_ORIGIN}/2/files/get_metadata`,
  listFolder: `${DROPBOX_API_ORIGIN}/2/files/list_folder`,
  listContinue: `${DROPBOX_API_ORIGIN}/2/files/list_folder/continue`,
  delete: `${DROPBOX_API_ORIGIN}/2/files/delete_v2`,
} as const
const CONTENT = {
  download: `${DROPBOX_CONTENT_ORIGIN}/2/files/download`,
  upload: `${DROPBOX_CONTENT_ORIGIN}/2/files/upload`,
  sessionStart: `${DROPBOX_CONTENT_ORIGIN}/2/files/upload_session/start`,
  sessionAppend: `${DROPBOX_CONTENT_ORIGIN}/2/files/upload_session/append_v2`,
  sessionFinish: `${DROPBOX_CONTENT_ORIGIN}/2/files/upload_session/finish`,
} as const

// What upload.ts and list.ts send through: a fixed endpoint, an argument, and the answer read.
export type DropboxCalls = {
  rpc(endpoint: keyof typeof RPC, arg: object): Promise<Response>
  content(endpoint: keyof typeof CONTENT, arg: object, body?: Uint8Array): Promise<Response>
  answer<T>(response: Response, schema: z.ZodType<T>): Promise<T>
  // As `answer`, but a 409 whose tag chain starts with one of `missing` gives null.
  lookup<T>(response: Response, schema: z.ZodType<T>, missing: string[]): Promise<T | null>
}

type Outgoing = { headers: Record<string, string>; body?: string | Uint8Array; timeoutMs: number }

export type DropboxStorageOptions = { fetch: typeof fetch; timeoutMs?: number }

const REFRESH_TOKEN = 'dropbox.refreshToken'
const RPC_TIMEOUT_MS = 60_000
const CONTENT_TIMEOUT_MS = 300_000
const MAX_ROOT = 200
const NOT_THERE = ['path/not_found', 'path/not_folder']
const NOT_A_FILE = 'Dropbox has a folder where a file was named'

const Metadata = z.object({ '.tag': z.string(), rev: z.string().min(1).max(64).optional() })
const Result = z.object({ size: z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER) })

// JSON for a header: every character outside printable ASCII as a \uXXXX escape.
export function headerArg(arg: object): string {
  return JSON.stringify(arg).replace(
    /[^\x20-\x7e]/g,
    (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, '0')}`,
  )
}

// The saved root, checked each time it is read: '' or parts that pass the storage path rules.
function rootOf(ctx: AdapterContext): string {
  const rootPath = ctx.settings().storage.dropbox?.rootPath ?? ''
  if (rootPath === '') return ''
  if (rootPath.length > MAX_ROOT || /\p{Cc}/u.test(rootPath)) refusePath()
  return storageFilePath(rootPath)
}

const chainStarts = (chain: string, start: string) =>
  chain === start || chain.startsWith(`${start}/`)

function parsedJson(bytes: Uint8Array): unknown {
  try {
    return JSON.parse(new TextDecoder().decode(bytes))
  } catch {
    throw new ProviderFailure({ kind: 'other', detail: UNREADABLE })
  }
}

function checked<T>(value: unknown, schema: z.ZodType<T>): T {
  const result = schema.safeParse(value)
  if (!result.success) throw new ProviderFailure({ kind: 'other', detail: UNREADABLE })
  return result.data
}

export function dropboxStorage(
  ctx: AdapterContext,
  options: DropboxStorageOptions,
): StorageProvider {
  const dropboxFetch = options.fetch
  const secrets = new Set<string>() // the refresh token and each access token used

  async function authorised(refreshToken: string, url: string, out: Outgoing) {
    const accessToken = await accessTokenFor(refreshToken, dropboxFetch)
    secrets.add(accessToken)
    return dropboxFetch(url, {
      method: 'POST',
      headers: { ...out.headers, authorization: `Bearer ${accessToken}` },
      body: out.body as BodyInit | undefined, // bytes in memory; Node takes any Uint8Array
      signal: AbortSignal.timeout(out.timeoutMs),
    })
  }

  async function send(url: string, out: Outgoing) {
    const refreshToken = ctx.secret(REFRESH_TOKEN)
    secrets.add(refreshToken)
    const first = await authorised(refreshToken, url, out)
    if (first.status !== 401) return first
    await first.body?.cancel().catch(() => undefined)
    forgetDropboxAccess(refreshToken)
    return authorised(refreshToken, url, out)
  }

  const calls: DropboxCalls = {
    rpc: (endpoint, arg) =>
      send(RPC[endpoint], {
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(arg),
        timeoutMs: options.timeoutMs ?? RPC_TIMEOUT_MS,
      }),
    content: (endpoint, arg, body) =>
      send(CONTENT[endpoint], {
        headers: {
          'dropbox-api-arg': headerArg(arg),
          ...(body ? { 'content-type': 'application/octet-stream' } : {}),
        },
        body,
        timeoutMs: options.timeoutMs ?? CONTENT_TIMEOUT_MS,
      }),
    async lookup(response, schema, missing) {
      const bytes = await readAnswer(response, MAX_JSON_ANSWER_BYTES)
      if (!response.ok) {
        const chain = errorTags(bytes).join('/')
        if (response.status === 409 && missing.some((m) => chainStarts(chain, m))) return null
        throw answerFailure(response.status, bytes, [...secrets])
      }
      return checked(parsedJson(bytes), schema)
    },
    answer: async (response, schema) => (await calls.lookup(response, schema, []))!,
  }

  async function run<T>(call: () => Promise<T>): Promise<T> {
    try {
      return await call()
    } catch (error) {
      throw thrownFailure(error, [...secrets])
    }
  }

  // The Dropbox path of one file, checked before anything is sent.
  function fileAt(path: string): string {
    const root = rootOf(ctx)
    const file = storageFilePath(path)
    return root === '' ? `/${file}` : `/${root}/${file}`
  }

  const metadataOf = async (path: string) =>
    calls.lookup(await calls.rpc('getMetadata', { path }), Metadata, NOT_THERE)

  async function download(path: string): Promise<Uint8Array> {
    const response = await calls.content('download', { path })
    if (!response.ok) {
      const bytes = await readAnswer(response, MAX_JSON_ANSWER_BYTES)
      throw answerFailure(response.status, bytes, [...secrets])
    }
    let size: number
    try {
      size = checked(JSON.parse(response.headers.get('dropbox-api-result') ?? ''), Result).size
    } catch {
      await response.body?.cancel().catch(() => undefined)
      throw new ProviderFailure({ kind: 'other', detail: UNREADABLE })
    }
    return readAnswer(response, size)
  }

  // Only a file, and only at the revision just looked up: delete_v2 would take a whole folder.
  async function removeOne(path: string): Promise<void> {
    const found = await metadataOf(path)
    if (found === null) return
    if (found['.tag'] !== 'file') throw new ProviderFailure({ kind: 'other', detail: NOT_A_FILE })
    if (!found.rev) throw new ProviderFailure({ kind: 'other', detail: UNREADABLE })
    const response = await calls.rpc('delete', { path, parent_rev: found.rev })
    await calls.lookup(response, z.unknown(), ['path_lookup/not_found'])
  }

  return {
    async exists(path) {
      const file = fileAt(path)
      return run(async () => (await metadataOf(file))?.['.tag'] === 'file')
    },

    async read(path) {
      const file = fileAt(path)
      return run(() => download(file))
    },

    async write(path, data) {
      const file = fileAt(path)
      await run(() => upload(calls, file, data))
    },

    async list(prefix) {
      const root = rootOf(ctx)
      const folder = storageListPrefix(prefix)
      const base = root === '' ? '' : `/${root}`
      const at = folder === '' ? base : `${base}/${folder.slice(0, -1)}`
      return run(() => listFiles(calls, at, `${base}/`))
    },

    async remove(paths) {
      const files = paths.map(fileAt)
      await run(async () => {
        for (const file of files) await removeOne(file)
      })
    },
  }
}
