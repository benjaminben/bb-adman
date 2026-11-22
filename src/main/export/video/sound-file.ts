// The one sound source of a video ad, read again from the project and checked (P8-17; spec/
// export-and-checks.md "Sound in export"; phase-07.md "How FFmpeg is run", rules for later FFmpeg
// slices). Security class short:
// - The variant row is read through its schema (sound is one of three values). 'file' needs an
//   asset row in the asset library of kind audio: a project file made by someone else never
//   passed variant.setSound.
// - The file comes from AssetService.resolve, then its real path, opened without following a
//   link, a regular file. Its type is sniffed from that handle's first bytes and must be one of
//   the four sound types; that type pins the demuxer (sound-args.ts).
// - It is copied (never linked) from the same handle into the work folder as `sound.{ext}`.
//   FFmpeg reads only that copy. Nothing here names a path; a missing file is named by its
//   display name only, as for clips.
import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { pipeline } from 'node:stream/promises'
import type { CoreDeps } from '@/main/core-deps'
import type { ProjectHandle } from '@/main/db/project-file'
import { readWireRow } from '@/main/db/rows'
import { sniffType, SNIFF_BYTES } from '@/main/assets/sniff'
import { readVariant } from '@/main/clips/write-clip'
import { missingFilesMessage } from '@/shared/export/messages'
import type { AssetRow } from '@/shared/schemas/rows/asset'
import { ExportFailure } from '@/main/export/failure'
import type { AdSound, SoundFileType } from './sound-args'

// The ad's failure for a sound source the checks refuse. It names nothing.
export const SOUND_REFUSED = "This ad's sound cannot be used. Check its sound file."

const NO_FOLLOW = constants.O_NOFOLLOW ?? 0
const SOUND_TYPES: ReadonlySet<string> = new Set<SoundFileType>(['mp3', 'wav', 'm4a', 'aac'])

const refused = (): never => {
  throw new ExportFailure(SOUND_REFUSED)
}

// The real file of `given`, checked and copied to `{workDir}/sound.{type}`.
async function copySound(given: string, workDir: string): Promise<AdSound> {
  const real = await fs.realpath(given).catch(refused)
  const handle = await fs.open(real, constants.O_RDONLY | NO_FOLLOW).catch(refused)
  try {
    if (!(await handle.stat()).isFile()) refused()
    const head = new Uint8Array(SNIFF_BYTES)
    const { bytesRead } = await handle.read(head, 0, SNIFF_BYTES, 0)
    const type = sniffType(path.basename(real), head.subarray(0, bytesRead))
    if (type?.kind !== 'audio' || !SOUND_TYPES.has(type.id)) return refused()
    const fileType = type.id as SoundFileType
    const copy = path.join(workDir, `sound.${fileType}`)
    const from = handle.createReadStream({ start: 0, autoClose: false })
    await pipeline(from, (await fs.open(copy, 'wx', 0o600)).createWriteStream())
    return { source: 'file', path: copy, fileType }
  } catch (e) {
    if (e instanceof ExportFailure) throw e
    return refused()
  } finally {
    await handle.close().catch(() => undefined)
  }
}

function assetRow(project: ProjectHandle, id: string): AssetRow | null {
  try {
    return readWireRow(project.db, 'asset', { id }) as AssetRow | null
  } catch {
    return null
  }
}

// Throws an ExportFailure: the missing file's name, or SOUND_REFUSED.
export async function adSound(
  deps: Pick<CoreDeps, 'assets'>,
  project: ProjectHandle,
  variantId: string,
  workDir: string,
): Promise<AdSound> {
  const variant = (() => {
    try {
      return readVariant(project.db, variantId)
    } catch {
      return refused()
    }
  })()
  if (!variant) return refused()
  if (variant.sound !== 'file') return { source: variant.sound === 'clips' ? 'clips' : 'none' }
  const id = variant.soundAssetId
  const asset = id ? assetRow(project, id) : null
  if (!id || asset?.library !== 'asset' || asset.kind !== 'audio') return refused()
  const file = await deps.assets.resolve(project, id).catch(() => 'missing' as const)
  if (file === 'missing') throw new ExportFailure(missingFilesMessage([asset.displayName]))
  return copySound(file, workDir)
}
