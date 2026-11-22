// Where the app's FFmpeg is (spec/phases/phase-07.md, "How FFmpeg is run"). The path is worked
// out by the app only: never from a project, a setting, the environment or a PATH lookup.
import { lstatSync } from 'node:fs'
import fs from 'node:fs/promises'
import path from 'node:path'

export type FfmpegPlace = {
  packaged: boolean
  // process.resourcesPath when packaged; app.getAppPath() in development.
  resourcesPath: string
  appPath: string
  platform: NodeJS.Platform
  arch: string
}

export function ffmpegPath(place: FfmpegPlace): string {
  const base = place.packaged ? place.resourcesPath : path.join(place.appPath, 'resources')
  const name = place.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg'
  return path.join(base, 'ffmpeg', `${place.platform}-${place.arch}`, name)
}

// A regular file by lstat: a link, a folder or a missing file is not run.
export async function binaryUsable(file: string): Promise<boolean> {
  try {
    return (await fs.lstat(file)).isFile()
  } catch {
    return false
  }
}

// The same rule, at once, for MediaTool.available().
export function binaryUsableNow(file: string): boolean {
  try {
    return lstatSync(file).isFile()
  } catch {
    return false
  }
}
