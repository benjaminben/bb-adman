// SPEC 3.6 "Asset files", 8.2, 12: an adman-asset://{projectId}/{assetId} address to the file
// it names, and the answer to a request for it. No Electron here; windows/asset-protocol.ts
// only hands requests in (SPEC 14, Slice A rulings point 2, security class).
import fs from 'node:fs'
import { Readable } from 'node:stream'
import type { ProjectRegistry } from '../db/project-registry'
import { readWireRow } from '../db/rows'
import { resolveRow } from './service'
import type { AssetRow } from '../../shared/schemas/rows/asset'

// The raw text is matched, not a parsed URL, so nothing is folded away ("/../", "%2F"):
// both parts are ULIDs (SPEC 3.2) and nothing else may follow. ULIDs ignore letter case, and
// a browser may lower-case the host, so both parts are read in upper case.
const ADDRESS = /^adman-asset:\/\/([0-9A-HJKMNP-TV-Z]{26})\/([0-9A-HJKMNP-TV-Z]{26})$/i

// The window has no use for a text asset, and its page policy allows no such load.
const SERVED_KINDS: readonly string[] = ['image', 'video', 'font']

// Sent with every answer: no type guessing, and a changed linked file is read again.
const FIXED_HEADERS = { 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' }

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
  if (!row || !SERVED_KINDS.includes(row.kind)) return null
  const file = await resolveRow(project, row)
  return file === 'missing' ? null : { file, mime: row.mime }
}

// Every failed check gets the same answer, so it never says which check failed.
function notFound(): Response {
  return new Response(null, { status: 404, headers: FIXED_HEADERS })
}

// GET only. The type is the row's, never one read from the file's name. The file is opened
// before answering, so a file that went after the check is a 404 too.
export async function answerAssetRequest(
  request: { method: string; url: string },
  projects: ProjectRegistry,
): Promise<Response> {
  if (request.method !== 'GET') return notFound()
  try {
    const found = await fileForAssetUrl(request.url, projects)
    if (!found) return notFound()
    const handle = await fs.promises.open(found.file, 'r')
    const body = Readable.toWeb(handle.createReadStream()) as ReadableStream<Uint8Array>
    return new Response(body, {
      status: 200,
      headers: { ...FIXED_HEADERS, 'Content-Type': found.mime },
    })
  } catch {
    return notFound()
  }
}
