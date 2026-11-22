// The clips of one video ad, as FFmpeg may read them (spec/phases/phase-08.md "Video"; phase-07.md
// "How FFmpeg is run", rules for later FFmpeg slices). Security class full.
// - Rows are read again here and checked with the clip commands' own rules (checkClip, clipAssetOf):
//   a project file made by someone else never passed those commands.
// - Each source comes from AssetService.resolve, then its real path, opened without following a
//   link, a regular file. Its type is sniffed from its first bytes; a video must give
//   videoFileFacts, a still is measured here. Stored sizes are not trusted.
// - The file is copied (never linked) into the work folder under a fixed name, `clip-{n}.{ext}`,
//   from the same open handle that was checked. FFmpeg reads only that copy, with the demuxer the
//   sniffed type pins (encoder-args.ts). The user's own path never reaches FFmpeg.
// - Placement numbers are clamped and rounded (safePlacement) before the filter graph.
import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import type { FileHandle } from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import { clipAssetOf, type ClipAsset } from '@/main/clips/clip-asset'
import { checkClip, clipsOf } from '@/main/clips/write-clip'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import { sniffType, SNIFF_BYTES } from '@/main/assets/sniff'
import { videoFileFacts } from '@/main/assets/video-file-facts'
import { MAX_PICTURE_BYTES, MAX_PICTURE_SIDE } from '@/main/providers/picture-limits'
import { pictureSize } from '@/main/providers/picture-size'
import { webpInfo } from '@/main/providers/webp-size'
import { missingFilesMessage } from '@/shared/export/messages'
import type { Size } from '@/shared/scene/background-placement'
import { safePlacement } from '@/shared/scene/clip-at'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import type { BackgroundClipRow } from '@/shared/schemas/rows/background-clip'
import { ExportFailure } from '@/main/export/failure'
import type { ClipFileType, VideoClip } from './encoder-args'

// The ad's failure for a clip row or clip file the checks refuse. It names nothing.
export const CLIP_REFUSED =
  "A clip on this ad's track cannot be used. Check its file, its trim and its place on the track."

const NO_FOLLOW = constants.O_NOFOLLOW ?? 0

// The sniffed types a clip may be, the kind its row must have, and the copy's extension.
const CLIP_TYPES: Partial<Record<string, { type: ClipFileType; kind: ClipAsset['kind'] }>> = {
  png: { type: 'png', kind: 'image' },
  jpeg: { type: 'jpeg', kind: 'image' },
  webp: { type: 'webp', kind: 'image' },
  mp4: { type: 'mp4', kind: 'video' },
  mov: { type: 'mov', kind: 'video' },
}
const COPY_EXT: Record<ClipFileType, string> = {
  png: 'png',
  jpeg: 'jpg',
  webp: 'webp',
  mp4: 'mp4',
  mov: 'mov',
  webm: 'webm',
}

type Copied = { path: string; fileType: ClipFileType; source: Size; durationMs: number | null }

const refused = (): never => {
  throw new ExportFailure(CLIP_REFUSED)
}

const assetRow = (project: ProjectHandle, id: string) =>
  readWireRow(project.db, 'asset', { id }) as AssetRow | null

function stillSize(bytes: Uint8Array, type: ClipFileType): Size {
  if (type === 'webp') {
    const info = webpInfo(bytes)
    if (info.animated) refused()
    return info
  }
  return pictureSize(bytes, type === 'png' ? 'image/png' : 'image/jpeg')
}

const usableSide = (n: number) => Number.isSafeInteger(n) && n >= 1 && n <= MAX_PICTURE_SIDE

async function copyFrom(handle: FileHandle, name: string, kind: string, to: string) {
  const stat = await handle.stat()
  if (!stat.isFile()) refused()
  const head = new Uint8Array(SNIFF_BYTES)
  const { bytesRead } = await handle.read(head, 0, SNIFF_BYTES, 0)
  const allowed = CLIP_TYPES[sniffType(name, head.subarray(0, bytesRead))?.id ?? '']
  if (!allowed || allowed.kind !== kind) return refused()
  const { type } = allowed
  const file = `${to}.${COPY_EXT[type]}`
  if (kind === 'video') {
    const facts = await videoFileFacts(handle)
    if (!facts) return refused()
    const from = handle.createReadStream({ start: 0, autoClose: false })
    await pipeline(from, (await fs.open(file, 'wx', 0o600)).createWriteStream())
    return { path: file, fileType: type, source: facts, durationMs: facts.durationMs }
  }
  if (stat.size > MAX_PICTURE_BYTES) refused()
  const bytes = new Uint8Array(stat.size)
  await handle.read(bytes, 0, stat.size, 0)
  const size = (() => {
    try {
      return stillSize(bytes, type)
    } catch {
      return refused()
    }
  })()
  if (!usableSide(size.width) || !usableSide(size.height)) refused()
  await fs.writeFile(file, bytes, { flag: 'wx', mode: 0o600 })
  const source = { width: size.width, height: size.height }
  return { path: file, fileType: type, source, durationMs: null }
}

// The real file of `given`, copied to `{to}.{ext}`.
async function copySource(given: string, kind: string, to: string): Promise<Copied> {
  const real = await fs.realpath(given).catch(refused)
  const handle = await fs.open(real, constants.O_RDONLY | NO_FOLLOW).catch(refused)
  try {
    return await copyFrom(handle, path.basename(real), kind, to)
  } catch (e) {
    if (e instanceof ExportFailure) throw e
    return refused()
  } finally {
    await handle.close().catch(() => undefined)
  }
}

async function resolved(deps: Pick<CoreDeps, 'assets'>, project: ProjectHandle, id: string) {
  return deps.assets.resolve(project, id).catch(() => 'missing' as const)
}

// The ad's clips, checked and copied into workDir. Throws an ExportFailure: a missing file
// (every name), or CLIP_REFUSED.
export async function clipFiles(
  deps: Pick<CoreDeps, 'assets'>,
  project: ProjectHandle,
  variantId: string,
  workDir: string,
): Promise<VideoClip[]> {
  const rows = clipsOf(project.db, variantId)
  const files: string[] = []
  const missing: string[] = []
  for (const row of rows) {
    const asset = assetRow(project, row.assetId)
    if (!asset) return refused()
    const file = await resolved(deps, project, row.assetId)
    if (file === 'missing') missing.push(asset.displayName)
    else files.push(file)
  }
  if (missing.length > 0) throw new ExportFailure(missingFilesMessage([...new Set(missing)]))
  const clips: VideoClip[] = []
  for (const [n, row] of rows.entries()) {
    clips.push(
      await checkedClip(project, row, rows, files[n] as string, path.join(workDir, `clip-${n}`)),
    )
  }
  return clips
}

async function checkedClip(
  project: ProjectHandle,
  row: BackgroundClipRow,
  track: BackgroundClipRow[],
  file: string,
  to: string,
): Promise<VideoClip> {
  let asset: ClipAsset
  try {
    asset = clipAssetOf(project.db, row.assetId)
  } catch {
    return refused()
  }
  const copied = await copySource(file, asset.kind, to)
  try {
    checkClip(row, { ...asset, durationMs: copied.durationMs }, track)
  } catch {
    return refused()
  }
  const { startMs, inMs, outMs } = row
  const placement = row.placement && safePlacement(row.placement)
  const { path: copy, fileType, source } = copied
  return { path: copy, fileType, source, startMs, inMs, outMs, placement }
}
