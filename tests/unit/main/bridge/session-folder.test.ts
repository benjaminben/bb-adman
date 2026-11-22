// Review fix (spec/mcp-and-agents.md "Bridge mode", owed hardening): in bridge mode Chromium's
// session data goes to a fresh folder in the system temp folder, removed when the bridge ends,
// so the bridge never writes Chromium's own files into the app data folder.
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import { tempSessionData } from '@/main/bridge/session-folder'

const made: string[] = []
afterEach(() => {
  for (const folder of made.splice(0)) fs.rmSync(folder, { recursive: true, force: true })
})

function start() {
  const calls: [string, string][] = []
  const remove = tempSessionData({ setPath: (name, value) => calls.push([name, value]) })
  const folder = calls[0]?.[1] ?? ''
  made.push(folder)
  return { calls, remove, folder }
}

describe('tempSessionData', () => {
  it('points sessionData at a new empty folder in the system temp folder', () => {
    const { calls, folder } = start()
    expect(calls).toEqual([['sessionData', folder]])
    expect(path.dirname(folder)).toBe(fs.realpathSync(os.tmpdir()))
    expect(fs.readdirSync(folder)).toEqual([])
  })

  it('makes a different folder on each start', () => {
    expect(start().folder).not.toBe(start().folder)
  })

  it('removes the folder and what Chromium put in it, and a second removal is harmless', () => {
    const { remove, folder } = start()
    fs.mkdirSync(path.join(folder, 'Session Storage'))
    fs.writeFileSync(path.join(folder, 'Session Storage', 'LOG'), 'x')
    remove()
    expect(fs.existsSync(folder)).toBe(false)
    expect(() => remove()).not.toThrow()
  })
})
