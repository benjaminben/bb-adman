// One component, checked again just before its upload (spec/phases/phase-09.md "Components",
// A-260). The row is read again and its file checked as collectComponents checked it; the file
// must still be the one collected. It is then opened once, inside the real path of its own
// folder (open-inside.ts: a regular file with one name, the folder not a link). An MP4 or MOV
// must give videoFileFacts. A font is read whole from that one handle, its type checked and its
// SHA-256 counted from those bytes, and those same bytes are what is uploaded, only when
// hasConsent(...) answers exactly true for that hash. Anything else is skipped with its problem.
import { createHash } from 'node:crypto'
import fs from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import path from 'node:path'
import { sniffType, SNIFF_BYTES } from '@/main/assets/sniff'
import { videoFileFacts } from '@/main/assets/video-file-facts'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import { contentTypeFor } from '@/shared/publish/content-types'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import { checkComponentFile } from './component-file'
import type { CollectedComponent } from './components'
import { openFileInside, openInside } from './open-inside'
import type { UploadFile } from './upload'

export type SkipProblem = 'missing' | 'wrong_type' | 'not_shared'
export type ComponentUpload = { file: UploadFile } | { problem: SkipProblem }

// A font is held in memory between its check and its upload; nothing larger is a usable font.
const FONT_MAX_BYTES = 32 * 1024 * 1024
const VIDEO_CHECKED = new Set(['mp4', 'mov'])

export type FontConsentFor = (assetId: string, sha256: string) => boolean

function rowOf(project: ProjectHandle, assetId: string): AssetRow | null {
  try {
    return readWireRow(project.db, 'asset', { id: assetId }) as AssetRow | null
  } catch {
    return null
  }
}

const bytesStream = (bytes: Uint8Array) =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(bytes)
      controller.close()
    },
  })

async function fontUpload(
  handle: FileHandle,
  c: CollectedComponent & { remotePath: string },
  name: string,
  consented: FontConsentFor,
): Promise<ComponentUpload> {
  const { size } = await handle.stat()
  if (size > FONT_MAX_BYTES) return { problem: 'wrong_type' }
  const bytes = new Uint8Array(await handle.readFile())
  if (sniffType(name, bytes.subarray(0, SNIFF_BYTES))?.kind !== 'font') {
    return { problem: 'wrong_type' }
  }
  const sha256 = createHash('sha256').update(bytes).digest('hex')
  if (consented(c.assetId, sha256) !== true) return { problem: 'not_shared' }
  const contentType = contentTypeFor(c.remotePath) as string
  return { file: { path: c.remotePath, contentType, open: () => bytesStream(bytes) } }
}

export async function componentUpload(
  project: ProjectHandle,
  c: CollectedComponent,
  consented: FontConsentFor,
): Promise<ComponentUpload> {
  if (c.problem !== null) return { problem: c.problem }
  if (c.remotePath === null) return { problem: 'not_shared' }
  const row = rowOf(project, c.assetId)
  if (!row) return { problem: 'missing' }
  const checked = await checkComponentFile(project, row)
  if ('problem' in checked) return { problem: checked.problem }
  if (checked.absPath !== c.absPath || !c.remotePath.endsWith(`.${checked.ext}`)) {
    return { problem: 'wrong_type' }
  }
  const name = path.basename(checked.absPath)
  const root = await fs.realpath(path.dirname(checked.absPath)).catch(() => null)
  if (root === null) return { problem: 'missing' }
  const file = path.join(root, name)
  const handle = await openInside(root, file).catch(() => null)
  if (handle === null) return { problem: 'wrong_type' }
  const remote = { ...c, remotePath: c.remotePath }
  try {
    if (c.kind === 'font') return await fontUpload(handle, remote, name, consented)
    if (VIDEO_CHECKED.has(checked.ext) && (await videoFileFacts(handle)) === null) {
      return { problem: 'wrong_type' }
    }
  } finally {
    await handle.close().catch(() => undefined)
  }
  const contentType = contentTypeFor(c.remotePath) as string
  return { file: { path: c.remotePath, contentType, open: () => openFileInside(root, file) } }
}
