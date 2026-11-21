// CU-9 (security class, A-54): the ComfyUI folder never uses Electron's built-in WebSocket or
// the global fetch, only live.ts imports `ws`, and the live files log nothing.
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'

const srcRoot = join(__dirname, '../../../../../src')
const folder = join(srcRoot, 'main/providers/comfyui')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx|mts|cts)$/.test(entry.name) && !entry.name.endsWith('.d.ts') ? [path] : []
  })
}

const read = (file: string) => readFileSync(file, 'utf8')
const name = (file: string) => relative(folder, file)
const comfyFiles = sourceFiles(folder)

describe('live connection source [CU-9, spec/comfyui.md "Live progress"]', () => {
  it('finds live.ts among the folder’s files', () => {
    expect(comfyFiles.map(name)).toContain('live.ts')
  })

  it.each(comfyFiles.map((f) => [name(f), f]))(
    '%s uses neither the global WebSocket nor fetch',
    (_name, file) => {
      const text = read(file)
      expect(text).not.toMatch(/\bfetch\s*\(|globalThis\.WebSocket|new\s+globalThis/)
      // The name WebSocket is only ever the `ws` class, imported by live.ts.
      if (name(file) === 'live.ts') expect(text).toMatch(/^import WebSocket from 'ws'$/m)
      else expect(text).not.toMatch(/\bWebSocket\b/)
    },
  )

  it('no file but live.ts imports ws', () => {
    const importers = sourceFiles(srcRoot).filter((f) => /from\s+['"]ws['"]/.test(read(f)))
    expect(importers.map((f) => relative(srcRoot, f))).toEqual(['main/providers/comfyui/live.ts'])
  })

  it.each(['live.ts', 'live-messages.ts', 'progress.ts'])('%s logs nothing', (file) => {
    expect(read(join(folder, file))).not.toMatch(/console\.|logger|log\(/i)
  })
})
