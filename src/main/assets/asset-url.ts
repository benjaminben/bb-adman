// SPEC 3.6 "Asset files", 8.2, 12: an adman-asset://{projectId}/{assetId} address to the file
// it names, and the answer to a request for it. No Electron here; windows/asset-protocol.ts
// only hands requests in (SPEC 14, Slice A rulings point 2, security class).
import fs from 'node:fs'
import { Readable } from 'node:stream'
import type { ProjectRegistry } from '@/main/db/project-registry'
import { readWireRow } from '@/main/db/rows'
import { resolveRow } from './service'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import { FILE_TYPES } from '@/shared/config/file-types'
import { parseRange } from './byte-range'

// The raw text is matched, not a parsed URL, so nothing is folded away ("/../", "%2F"):
// both parts are ULIDs (SPEC 3.2) and nothing else may follow. ULIDs ignore letter case, and
// a browser may lower-case the host, so both parts are read in upper case.
const ADDRESS = /^adman-asset:\/\/([0-9A-HJKMNP-TV-Z]{26})\/([0-9A-HJKMNP-TV-Z]{26})$/i

// The window has no use for a text asset, and its page policy allows no such load. An audio
// row is served once file-types.ts lists its types (knownMime below).
const SERVED_KINDS: readonly string[] = ['image', 'video', 'font', 'audio']

// Sent with every answer: no type guessing, and a changed linked file is read again.
const FIXED_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }

// SPEC 14 [1.30] U5: the row comes from a project file, so its type is sent only when
// file-types.ts lists it for the row's kind.
function knownMime(row: AssetRow): boolean {
  return FILE_TYPES.some((t) => t.kind === row.kind && t.mime === row.mime)
}

export async function fileForAssetUrl(
  url: string,
  projects: ProjectRegistry,
): Promise<{ file: string; mime: string } | null> {
  const match = ADDRESS.exec(url)
  if (!match) return null
  const projectId = (match[1] ?? '').toUpperCase()
  const assetId = (match[2] ?? '').toUpperCase()
  const project = projects.get(projectId)
  if (!project) return null
  const row = readWireRow(project.db, 'asset', { id: assetId }) as AssetRow | null
  if (!row || !SERVED_KINDS.includes(row.kind) || !knownMime(row)) return null
  const file = await resolveRow(project, row)
  return file === 'missing' ? null : { file, mime: row.mime }
}

// Every failed check gets the same answer, so it never says which check failed.
function notFound(): Response {
  return new Response(null, { status: 404, headers: FIXED_HEADERS })
}

// Only the Range header is read from a request's headers.
export type AssetRequest = {
  method: string
  url: string
  headers?: { get(name: string): string | null }
}

function unsatisfiable(size: number): Response {
  const headers = { ...FIXED_HEADERS, 'Content-Range': `bytes */${size}` }
  return new Response(null, { status: 416, headers })
}

// Bytes start..end of the open file, end included; an empty file gets no stream.
function bodyOf(handle: fs.promises.FileHandle, start: number, end: number) {
  if (end < start) {
    void handle.close()
    return null
  }
  return Readable.toWeb(handle.createReadStream({ start, end })) as ReadableStream<Uint8Array>
}

// GET only. The type is the row's, never one read from the file's name or the request. The
// file is opened before answering, so a file that went after the check is a 404 too, and its
// size is read from the open handle, so a file swapped after the open is never measured.
// P7-6: one byte range gets 206 with exactly those bytes; a range past the file gets 416.
export async function answerAssetRequest(
  request: AssetRequest,
  projects: ProjectRegistry,
): Promise<Response> {
  if (request.method !== 'GET') return notFound()
  let handle: fs.promises.FileHandle | null = null
  try {
    const found = await fileForAssetUrl(request.url, projects)
    if (!found) return notFound()
    handle = await fs.promises.open(found.file, 'r')
    const { size } = await handle.stat()
    const range = parseRange(request.headers?.get('range'), size)
    if (range === 'unsatisfiable') {
      await handle.close()
      return unsatisfiable(size)
    }
    const { start, end } = range === 'whole' ? { start: 0, end: size - 1 } : range
    const headers: Record<string, string> = {
      ...FIXED_HEADERS,
      'Content-Type': found.mime,
      'Accept-Ranges': 'bytes',
      'Content-Length': String(end - start + 1),
    }
    if (range !== 'whole') headers['Content-Range'] = `bytes ${start}-${end}/${size}`
    const status = range === 'whole' ? 200 : 206
    return new Response(bodyOf(handle, start, end), { status, headers })
  } catch {
    await handle?.close().catch(() => undefined)
    return notFound()
  }
}
