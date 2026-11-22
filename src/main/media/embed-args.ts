// The one argument builder of the media runner (spec/phases/phase-07.md, "The embed arguments").
// Security: an array, never a shell string, of fixed flags. Every input is
// `-protocol_whitelist file,pipe`, a pinned demuxer, then `file:` and an absolute path inside the
// run folder (the convention of src/main/export/video/encoder-args.ts). No project text is an
// argument: the details travel in meta.txt.
// Never switch on the mov demuxer's data references: they would let a crafted file make FFmpeg
// open another file on this machine (tests/unit/main/media/no-dref-flags.test.ts).
import path from 'node:path'

export type EmbedPaths = { input: string; meta: string; output: string }

const WHITELIST = ['-protocol_whitelist', 'file,pipe']

export function embedPaths(folder: string): EmbedPaths {
  return {
    input: path.join(folder, 'in.mp4'),
    meta: path.join(folder, 'meta.txt'),
    output: path.join(folder, 'out.mp4'),
  }
}

function inside(folder: string, file: string): string {
  if (!path.isAbsolute(folder) || !path.isAbsolute(file)) {
    throw new Error('FFmpeg is given absolute paths only.')
  }
  if (path.dirname(path.resolve(file)) !== path.resolve(folder)) {
    throw new Error('FFmpeg is given files of its run folder only.')
  }
  return `file:${path.resolve(file)}`
}

export function embedArgs(folder: string, paths: EmbedPaths): string[] {
  return [
    '-hide_banner',
    '-nostdin',
    '-loglevel',
    'error',
    ...WHITELIST,
    '-f',
    'mov',
    '-i',
    inside(folder, paths.input),
    ...WHITELIST,
    '-f',
    'ffmetadata',
    '-i',
    inside(folder, paths.meta),
    '-map',
    '0:v',
    '-map',
    '0:a?',
    '-map_metadata',
    '1',
    '-c',
    'copy',
    '-f',
    'mp4',
    '-n',
    inside(folder, paths.output),
  ]
}
