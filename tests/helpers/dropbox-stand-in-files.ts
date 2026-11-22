// The file routes of the Dropbox stand-in (spec/phases/phase-09-slices.md "P9-3"): get_metadata,
// download, upload, the upload session, list_folder and its continue, delete_v2. Files live in
// memory, keyed by the lower-case path, so names match whatever their case, as in Dropbox. A
// folder is there while a file is under it. Each route answers only on its own host, only to a
// bearer token the stand-in gave out and has not revoked, and only through the JSON body (API
// host) or the Dropbox-API-Arg header (content host). Tests only: nothing here reaches Dropbox.
import { randomBytes } from 'node:crypto'
import type { DropboxSeen, DropboxStandIn, ExtraRoutes, Reply } from './dropbox-stand-in'
import { startDropboxStandIn } from './dropbox-stand-in'

type StoredFile = { display: string; bytes: Buffer; rev: string }
type Arg = Record<string, unknown>

export type DropboxFiles = {
  files: Map<string, StoredFile>
  // At most this many entries per list_folder page, so `continue` is used.
  pageSize: number
  displayPaths(): string[]
}

const API = 'api.dropboxapi.com'
const CONTENT = 'content.dropboxapi.com'
const HOSTS: Record<string, string> = {
  'files/get_metadata': API,
  'files/list_folder': API,
  'files/list_folder/continue': API,
  'files/delete_v2': API,
  'files/download': CONTENT,
  'files/upload': CONTENT,
  'files/upload_session/start': CONTENT,
  'files/upload_session/append_v2': CONTENT,
  'files/upload_session/finish': CONTENT,
}

const json = (status: number, body: unknown): Reply => ({ status, json: body })
const nested = (chain: string) =>
  chain
    .split('/')
    .reverse()
    .reduce<Record<string, unknown>>((inner, tag) => ({ '.tag': tag, [tag]: inner }), {})
const apiError = (chain: string) =>
  json(409, { error_summary: `${chain}/..`, error: nested(chain) })
const rev = () => randomBytes(8).toString('hex').padStart(9, '0')

function argOf(seen: DropboxSeen): Arg | undefined {
  const raw = seen.host === CONTENT ? seen.headers['dropbox-api-arg'] : seen.body.toString()
  if (typeof raw !== 'string') return undefined
  if (seen.host === CONTENT && !/^[\x20-\x7e]*$/.test(raw)) return undefined
  try {
    const parsed: unknown = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null ? (parsed as Arg) : undefined
  } catch {
    return undefined
  }
}

const nameOf = (display: string) => display.slice(display.lastIndexOf('/') + 1)
const isOverwrite = (mode: unknown) =>
  mode === 'overwrite' || (mode as Arg | undefined)?.['.tag'] === 'overwrite'

export function dropboxFileRoutes(): { routes: ExtraRoutes; store: DropboxFiles } {
  const files = new Map<string, StoredFile>()
  const sessions = new Map<string, Buffer>()
  const store: DropboxFiles = {
    files,
    pageSize: 3,
    displayPaths: () => [...files.values()].map((f) => f.display).sort(),
  }

  const isFolder = (lower: string) =>
    lower === '' || [...files.keys()].some((key) => key.startsWith(`${lower}/`))
  const throughFile = (lower: string) =>
    [...files.keys()].some((key) => lower.startsWith(`${key}/`))
  const fileMeta = (lower: string, f: StoredFile) => ({
    '.tag': 'file',
    name: nameOf(f.display),
    path_lower: lower,
    path_display: f.display,
    id: `id:${lower}`,
    rev: f.rev,
    size: f.bytes.length,
  })
  const folderMeta = (lower: string, display: string) => ({
    '.tag': 'folder',
    name: nameOf(display),
    path_lower: lower,
    path_display: display,
    id: `id:${lower}`,
  })

  function put(path: string, bytes: Buffer, mode: unknown): Reply {
    const lower = path.toLowerCase()
    if (!isOverwrite(mode)) return json(400, { error: 'stand-in wants mode overwrite' })
    if (isFolder(lower)) return apiError('path/conflict/folder')
    if (throughFile(lower)) return apiError('path/conflict/file')
    const f = { display: path, bytes, rev: rev() }
    files.set(lower, f)
    return json(200, fileMeta(lower, f))
  }

  function listed(path: string, offset: number): Reply {
    const lower = path.toLowerCase()
    if (files.has(lower)) return apiError('path/not_folder')
    if (!isFolder(lower)) return apiError('path/not_found')
    const entries: unknown[] = []
    const folders = new Set<string>()
    for (const [key, f] of [...files].sort(([a], [b]) => a.localeCompare(b))) {
      if (!key.startsWith(`${lower}/`)) continue
      const parts = f.display.split('/')
      for (let i = 2; i < parts.length; i += 1) {
        const display = parts.slice(0, i).join('/')
        const folder = display.toLowerCase()
        if (folder.length > lower.length && !folders.has(folder)) {
          folders.add(folder)
          entries.push(folderMeta(folder, display))
        }
      }
      entries.push(fileMeta(key, f))
    }
    const page = entries.slice(offset, offset + store.pageSize)
    const next = offset + store.pageSize
    const cursor = Buffer.from(JSON.stringify({ path, next })).toString('base64url')
    return json(200, { entries: page, cursor, has_more: next < entries.length })
  }

  function removed(path: string, parentRev: unknown): Reply {
    const lower = path.toLowerCase()
    const f = files.get(lower)
    if (f) {
      if (parentRev !== undefined && parentRev !== f.rev) return apiError('path_lookup/conflict')
      files.delete(lower)
      return json(200, { metadata: fileMeta(lower, f) })
    }
    if (!isFolder(lower) || lower === '') return apiError('path_lookup/not_found')
    if (parentRev !== undefined) return apiError('path_lookup/not_file')
    for (const key of [...files.keys()]) if (key.startsWith(`${lower}/`)) files.delete(key)
    return json(200, { metadata: folderMeta(lower, path) })
  }

  function session(route: string, arg: Arg, body: Buffer): Reply {
    if (route === 'files/upload_session/start') {
      const id = `stand-in-session-${randomBytes(6).toString('hex')}`
      sessions.set(id, body)
      return json(200, { session_id: id })
    }
    const cursor = (arg.cursor ?? {}) as Arg
    const held = sessions.get(String(cursor.session_id))
    if (!held) return apiError('lookup_failed/not_found')
    if (cursor.offset !== held.length) return apiError('lookup_failed/incorrect_offset')
    const whole = Buffer.concat([held, body])
    sessions.set(String(cursor.session_id), whole)
    if (route === 'files/upload_session/append_v2') return { status: 200, text: 'null' }
    sessions.delete(String(cursor.session_id))
    const commit = (arg.commit ?? {}) as Arg
    return put(String(commit.path), whole, commit.mode)
  }

  function fileRoute(seen: DropboxSeen, arg: Arg): Reply | undefined {
    const path = String(arg.path)
    const lower = path.toLowerCase()
    switch (seen.route) {
      case 'files/get_metadata': {
        const f = files.get(lower)
        if (f) return json(200, fileMeta(lower, f))
        if (isFolder(lower) && !throughFile(lower)) return json(200, folderMeta(lower, path))
        return apiError('path/not_found')
      }
      case 'files/download': {
        const f = files.get(lower)
        if (!f) return apiError('path/not_found')
        const result = JSON.stringify(fileMeta(lower, f))
        // The stand-in hands `text` to res.end unchanged, and res.end sends a Buffer as bytes:
        // a string would go out as UTF-8 and change every byte over 127.
        const text = f.bytes as unknown as string
        return { status: 200, text, headers: { 'dropbox-api-result': result } }
      }
      case 'files/upload':
        return put(path, seen.body, arg.mode)
      case 'files/list_folder':
        return arg.recursive === true ? listed(path, 0) : json(400, { error: 'want recursive' })
      case 'files/list_folder/continue': {
        const { path: at, next } = JSON.parse(
          Buffer.from(String(arg.cursor), 'base64url').toString(),
        )
        return listed(String(at), Number(next))
      }
      case 'files/delete_v2':
        return removed(path, arg.parent_rev)
      default:
        return session(seen.route, arg, seen.body)
    }
  }

  const routes: ExtraRoutes = (seen: DropboxSeen, standIn: DropboxStandIn) => {
    const host = HOSTS[seen.route]
    if (!host) return undefined
    if (seen.method !== 'POST' || seen.host !== host) return json(400, { error: 'wrong host' })
    const token = /^Bearer (\S+)$/.exec(seen.headers.authorization ?? '')?.[1]
    const refresh = token ? standIn.refreshFor(token) : undefined
    if (!refresh || standIn.isRevoked(refresh))
      return json(401, {
        error_summary: 'invalid_access_token/',
        error: nested('invalid_access_token'),
      })
    const arg = argOf(seen)
    if (!arg) return json(400, { error: 'unreadable argument' })
    return fileRoute(seen, arg)
  }
  return { routes, store }
}

// A stand-in with the auth routes and the file routes.
export async function startDropboxFilesStandIn(): Promise<{
  standIn: DropboxStandIn
  store: DropboxFiles
}> {
  const { routes, store } = dropboxFileRoutes()
  return { standIn: await startDropboxStandIn(routes), store }
}
