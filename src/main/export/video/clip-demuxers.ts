// The one table of a clip's pinned FFmpeg demuxer by its sniffed type (src/shared/config/
// file-types.ts). A clip's picture (encoder-args.ts) and its own sound (sound-args.ts) are both
// read with it, so a file is never probed, nor read as a playlist or a script.
export type ClipFileType = 'png' | 'jpeg' | 'webp' | 'mp4' | 'mov' | 'webm'

export const CLIP_DEMUXERS: Readonly<Record<ClipFileType, string>> = {
  mp4: 'mov',
  mov: 'mov',
  webm: 'matroska',
  png: 'image2',
  jpeg: 'image2',
  webp: 'image2',
}
