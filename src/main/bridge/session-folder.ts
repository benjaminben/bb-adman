// Bridge mode (spec/mcp-and-agents.md "Bridge mode", owed hardening): the bridge runs on the
// user's real app data folder, maybe while the app runs, so Chromium's own session files go to
// a fresh folder in the system temp folder instead. Called before the app is ready; the
// function it gives back removes the folder and is safe to call more than once.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export type SessionPathApp = { setPath(name: 'sessionData', value: string): void }

const SESSION_FOLDER_PREFIX = 'adman-bridge-'

export function tempSessionData(app: SessionPathApp): () => void {
  const base = fs.realpathSync(os.tmpdir())
  const folder = fs.mkdtempSync(path.join(base, SESSION_FOLDER_PREFIX))
  app.setPath('sessionData', folder)
  return () => fs.rmSync(folder, { recursive: true, force: true })
}
