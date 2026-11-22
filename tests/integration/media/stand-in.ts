// A stand-in FFmpeg for the media runner tests: a Node script run through its shebang, so the
// runner's real spawn is used. macOS and Linux only.
import fs from 'node:fs'
import path from 'node:path'

export function writeStandIn(dir: string, body: string): string {
  const file = path.join(dir, `ffmpeg-${fs.readdirSync(dir).length}`)
  fs.writeFileSync(file, `#!${process.execPath}\n${body}\n`, { mode: 0o755 })
  return file
}
