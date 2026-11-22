// The report still of a video ad (spec/phases/phase-08.md "Video", "Report still"): one PNG
// frame from the middle of the work file, read from FFmpeg's standard output (stillArgs). The
// export run shrinks it into the report's picture. A still that cannot be made is null: the ad
// is still exported, and the report shows no picture for it.
import type { FfmpegRunner } from '@/main/media/run-ffmpeg'
import { stillArgs } from './still-args'

// More than any PNG of the largest ad; past it the still is dropped.
const MAX_STILL_BYTES = 64 * 1024 * 1024

export async function reportStill(
  runner: FfmpegRunner,
  workDir: string,
  durationMs: number,
  signal: AbortSignal,
): Promise<Uint8Array | null> {
  const chunks: Buffer[] = []
  let size = 0
  const output = (chunk: Buffer) => {
    size += chunk.length
    if (size <= MAX_STILL_BYTES) chunks.push(chunk)
  }
  const result = await runner.run(stillArgs(workDir, durationMs), workDir, { output, signal })
  if (result !== 'done' || size === 0 || size > MAX_STILL_BYTES) return null
  return new Uint8Array(Buffer.concat(chunks))
}
