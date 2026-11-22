// The media tool over the fetched FFmpeg (spec/phases/phase-07.md, "Clip facts, FFmpeg and the
// details", A-179): writes a generated clip's details into its global `comment` by stream copy.
// The output must pass checkMp4 with the same width, height, duration and sound as the input,
// else null and the caller keeps the original. Every run uses a fresh run folder that is removed
// afterwards on every path; making the tool sweeps left-over ones. A warn line names a fixed reason only: never standard error, a path
// or the details.
import fs from 'node:fs/promises'
import type { ActivityLog } from '@/main/log/activity-log'
import { MAX_VIDEO_BYTES } from '@/main/providers/picture-limits'
import { checkMp4, type Mp4Details } from '@/main/providers/video-check'
import { embedArgs, embedPaths } from './embed-args'
import { ffmetadataText } from './ffmetadata'
import { binaryUsableNow } from './ffmpeg-path'
import { createFfmpegRunner } from './run-ffmpeg'
import { makeRunFolder, removeRunFolder, sweepRunFolders, writeRunFile } from './run-folder'
import type { MediaTool } from './types'

type Reason =
  'ffmpeg_missing' | 'input_not_mp4' | 'run_failed' | 'output_unusable' | 'output_differs'

function factsOf(bytes: Uint8Array): Mp4Details | null {
  try {
    return checkMp4(bytes)
  } catch {
    return null
  }
}

function sameFacts(a: Mp4Details, b: Mp4Details): boolean {
  return (
    a.width === b.width &&
    a.height === b.height &&
    a.durationMs === b.durationMs &&
    a.hasSound === b.hasSound
  )
}

// The output, when it is a regular file no larger than a video may be.
async function readOutput(file: string): Promise<Uint8Array | null> {
  try {
    const stat = await fs.lstat(file)
    if (!stat.isFile() || stat.size > MAX_VIDEO_BYTES) return null
    return new Uint8Array(await fs.readFile(file))
  } catch {
    return null
  }
}

export function createMediaTool(opts: {
  binary: string
  userData: string
  log: Pick<ActivityLog, 'write'>
}): MediaTool {
  const runner = createFfmpegRunner({ binary: opts.binary })
  // The start-up sweep of left-over run folders; the first run waits for it, so it never
  // removes a folder in use.
  const swept = sweepRunFolders(opts.userData).catch(() => undefined)

  const skip = (reason: Reason): null => {
    opts.log.write({
      level: 'warn',
      event: 'job',
      name: 'media.embed',
      actor: 'system',
      ok: false,
      errorKind: reason,
      message: `The generation details were not written into the clip (${reason}).`,
    })
    return null
  }

  async function embedIn(folder: string, bytes: Uint8Array, details: Record<string, unknown>) {
    const paths = embedPaths(folder)
    await writeRunFile(folder, 'in.mp4', bytes)
    await writeRunFile(folder, 'meta.txt', ffmetadataText(JSON.stringify(details)))
    if ((await runner.run(embedArgs(folder, paths), folder)) !== 'done') return skip('run_failed')
    const out = await readOutput(paths.output)
    return out ? { out, facts: factsOf(out) } : skip('output_unusable')
  }

  return {
    available: () => binaryUsableNow(opts.binary),
    ffmpeg: runner,
    async embedDetails({ bytes, details }) {
      if (!binaryUsableNow(opts.binary)) return skip('ffmpeg_missing')
      const before = factsOf(bytes)
      if (!before) return skip('input_not_mp4')
      await swept
      let folder: string | null = null
      try {
        folder = await makeRunFolder(opts.userData)
        const written = await embedIn(folder, bytes, details)
        if (!written) return null
        if (!written.facts) return skip('output_unusable')
        return sameFacts(before, written.facts) ? written.out : skip('output_differs')
      } catch {
        return skip('run_failed')
      } finally {
        if (folder) await removeRunFolder(opts.userData, folder).catch(() => undefined)
      }
    },
  }
}
