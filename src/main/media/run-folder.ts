// The work folders of FFmpeg runs (spec/phases/phase-07.md, "How FFmpeg is run"): each run gets
// `{userData}/media-temp/run-{ULID}/`, made by the app, removed after the run; left-over run
// folders are removed at app start. A link is never followed: not in place of media-temp, not in
// place of a run folder.
import fs from 'node:fs/promises'
import path from 'node:path'
import { ulid } from 'ulid'

const TEMP = 'media-temp'
const RUN_NAME = /^run-[0-9A-HJKMNP-TV-Z]{26}$/

export type RunFileName = 'in.mp4' | 'meta.txt' | 'out.mp4'

function tempOf(userData: string): string {
  return path.join(path.resolve(userData), TEMP)
}

async function realFolder(dir: string): Promise<boolean> {
  try {
    return (await fs.lstat(dir)).isDirectory()
  } catch {
    return false
  }
}

export async function makeRunFolder(userData: string): Promise<string> {
  const temp = tempOf(userData)
  await fs.mkdir(temp, { recursive: true, mode: 0o700 })
  if (!(await realFolder(temp))) throw new Error('The media work folder is not a folder.')
  const folder = path.join(temp, `run-${ulid()}`)
  await fs.mkdir(folder, { mode: 0o700 })
  return folder
}

// Written once: 'wx' fails when the name is already there, so nothing is written through a link.
export async function writeRunFile(
  folder: string,
  name: RunFileName,
  data: Uint8Array | string,
): Promise<void> {
  await fs.writeFile(path.join(folder, name), data, { flag: 'wx', mode: 0o600 })
}

// Removes one run folder, only when it is a real run folder directly inside media-temp.
export async function removeRunFolder(userData: string, folder: string): Promise<void> {
  const resolved = path.resolve(folder)
  if (path.dirname(resolved) !== tempOf(userData)) return
  if (!RUN_NAME.test(path.basename(resolved))) return
  if (!(await realFolder(resolved))) return
  await fs.rm(resolved, { recursive: true, force: true })
}

// At app start: every real run-* folder left by a run that did not finish.
export async function sweepRunFolders(userData: string): Promise<void> {
  const temp = tempOf(userData)
  if (!(await realFolder(temp))) return
  const entries = await fs.readdir(temp, { withFileTypes: true })
  for (const entry of entries) {
    if (entry.isDirectory() && RUN_NAME.test(entry.name)) {
      await fs.rm(path.join(temp, entry.name), { recursive: true, force: true })
    }
  }
}
