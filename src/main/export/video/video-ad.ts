// One video ad of an export (spec/phases/phase-08.md "Video", "Export run"; spec/export-and-
// checks.md "Video variant"). Security class full. In a fresh work folder of its own
// (export-work/{ULID}, work-dir.ts): the clips are checked and copied in (clip-files.ts), FFmpeg
// is run through the app's one runner with the frames piped to pipe:0 and writes only ad.mp4 in
// that folder; the still is read from it; the file then reaches the output folder only through
// the export target. The work folder is removed on every path. A stop kills FFmpeg at once.
import { constants } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'
import { Readable } from 'node:stream'
import { ulid } from 'ulid'
import type { JobRunContext } from '@/main/jobs/types'
import { ProviderCancelled } from '@/main/providers/types'
import { VariantKey } from '@/shared/approvals/contract'
import { AD_FAILURES } from '@/shared/export/messages'
import { frameCount, frameTimeMs } from '@/shared/export/frames'
import { safePlacement } from '@/shared/scene/clip-at'
import type { SceneInput } from '@/shared/scene/types'
import type { Geometry } from '@/shared/schemas/layer'
import { ExportFailure } from '@/main/export/failure'
import type { ExportPlan, ExportTarget } from '@/main/export/types'
import { clipFiles } from './clip-files'
import { videoArgs, workVideoPath, type VideoClip } from './encoder-args'
import { pipeFrames } from './frame-pipe'
import { reportStill } from './still'
import { makeWorkDir } from './work-dir'

const SYSTEMS: ReadonlySet<NodeJS.Platform> = new Set(['darwin', 'win32'])

// The encode's time limit: a minute, and a second for each frame drawn.
const ENCODE_BASE_MS = 60_000
const PER_FRAME_MS = 1_000

const notMade = () => new ExportFailure(AD_FAILURES.videoNotMade)
const NO_FOLLOW = constants.O_NOFOLLOW ?? 0

// The variant of an ad file, `{language}-{variantId}.mp4` (output-paths.ts), or null.
export function variantIdOf(file: string): string | null {
  const name = path.posix.basename(file, '.mp4')
  const id = name.slice(name.lastIndexOf('-') + 1)
  return VariantKey.safeParse(id).success ? id : null
}

// The background layer's geometry, clamped; the whole ad when it has none.
function backgroundOf(scene: SceneInput): Geometry {
  const layer = scene.layers.find((l) => l.type === 'background')
  if (layer) return safePlacement(layer.geometry)
  const { width, height } = scene.variant
  return { x: 0, y: 0, width, height, rotation: 0, crop: null }
}

async function encode(
  jc: JobRunContext,
  scene: SceneInput,
  fps: ExportPlan['fps'],
  clips: VideoClip[],
  workDir: string,
): Promise<void> {
  const { width, height, durationMs } = scene.variant
  const args = (() => {
    try {
      const size = { width, height }
      const background = backgroundOf(scene)
      return videoArgs({
        platform: process.platform,
        size,
        durationMs,
        fps,
        background,
        clips,
        workDir,
      })
    } catch {
      throw notMade()
    }
  })()
  const count = frameCount(durationMs, fps)
  const frames: SceneInput = { ...scene, mode: 'overlay-only' }
  const draw = (i: number) => jc.deps.render.drawFull({ ...frames, timeMs: frameTimeMs(i, fps) })
  const result = await jc.deps.media.ffmpeg.run(args, workDir, {
    timeoutMs: ENCODE_BASE_MS + count * PER_FRAME_MS,
    signal: jc.signal,
    feed: (sink) => pipeFrames({ count, draw, sink, signal: jc.signal }),
  })
  if (jc.cancelled()) throw new ProviderCancelled()
  if (result !== 'done') throw notMade()
}

// The work file, opened without following a link and checked to be a regular file, streamed
// through the target to its name under the output folder.
async function writeOut(target: ExportTarget, name: string, workDir: string): Promise<void> {
  const handle = await fs.open(workVideoPath(workDir), constants.O_RDONLY | NO_FOLLOW).catch(() => {
    throw notMade()
  })
  try {
    if (!(await handle.stat()).isFile()) throw notMade()
    const stream = Readable.toWeb(handle.createReadStream({ autoClose: false }))
    await target.write(name, stream as ReadableStream<Uint8Array>).catch(() => {
      throw new ExportFailure(AD_FAILURES.notWritten)
    })
  } finally {
    await handle.close().catch(() => undefined)
  }
}

// Gives the report still (PNG), or null. Throws an ExportFailure with the ad's sentence, or
// ProviderCancelled when a stop was asked before the file was written.
export async function exportVideoAd(
  jc: JobRunContext,
  scene: SceneInput,
  plan: ExportPlan,
  target: ExportTarget,
  file: string,
): Promise<{ still: Uint8Array | null }> {
  if (!SYSTEMS.has(process.platform)) throw new ExportFailure(AD_FAILURES.videoSystem)
  const project = jc.deps.projects.get(plan.projectId)
  const variantId = variantIdOf(file)
  if (!project || !variantId) throw notMade()
  const work = await makeWorkDir(jc.deps.userDataDir, ulid()).catch(() => {
    throw notMade()
  })
  try {
    const clips = await clipFiles(jc.deps, project, variantId, work.path)
    if (jc.cancelled()) throw new ProviderCancelled()
    await encode(jc, scene, plan.fps, clips, work.path)
    const { durationMs } = scene.variant
    const still = await reportStill(jc.deps.media.ffmpeg, work.path, durationMs, jc.signal)
    if (jc.cancelled()) throw new ProviderCancelled()
    await writeOut(target, file, work.path)
    return { still }
  } finally {
    await work.remove()
  }
}
