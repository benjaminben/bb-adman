// The report still of a video ad (spec/phases/phase-08.md "Video", "Report still"): one PNG frame
// from the middle of the work file, written to stdout. The caller shrinks it.
import { seconds } from './filter-graph'
import { workVideoPath } from './encoder-args'

export function stillArgs(workDir: string, durationMs: number): string[] {
  return [
    '-hide_banner',
    '-loglevel',
    'error',
    '-protocol_whitelist',
    'file,pipe',
    '-f',
    'mov',
    '-ss',
    seconds(durationMs / 2),
    '-i',
    `file:${workVideoPath(workDir)}`,
    '-frames:v',
    '1',
    '-f',
    'image2pipe',
    '-c:v',
    'png',
    'pipe:1',
  ]
}
