import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import * as clientModule from '@/main/providers/comfyui/client'
import * as indexModule from '@/main/providers/comfyui/index'

const folder = join(__dirname, '../../../../../src/main/providers/comfyui')
// The client's source: the call list, how a request is sent, and the upload form.
const files = ['client.ts', 'request.ts', 'upload-form.ts', 'refusal.ts']
const source = (file: string) => readFileSync(join(folder, file), 'utf8')

describe('calls the client cannot make [SPEC 6.10.2, REQ FR-271, FR-289, 14 CU-2]', () => {
  it.each(files)('%s holds no clear, /free, /userdata, /users or DELETE', (file) => {
    const text = source(file)
    for (const word of ['clear', '/free', '/userdata', '/users', 'DELETE']) {
      expect(text, `${file} holds ${word}`).not.toContain(word)
    }
  })

  it.each(files)('%s never reads a Location header', (file) => {
    expect(source(file).toLowerCase()).not.toContain('location')
  })

  it('exports createComfyClient and no general request function', () => {
    expect(Object.keys(clientModule)).toEqual(['createComfyClient'])
  })

  it('uses neither Electron net nor the global fetch', () => {
    for (const file of files) {
      expect(source(file)).not.toMatch(/from 'electron'|fetch\(/)
    }
  })
})

const srcRoot = join(__dirname, '../../../../../src')

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.(ts|tsx|mts|cts)$/.test(entry.name) ? [path] : []
  })
}

// Every module a file names in an import or export, resolved to a path with no extension.
function namedModules(file: string): string[] {
  const text = readFileSync(file, 'utf8')
  const specifiers = [...text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)]
  return specifiers
    .map((m) => m[1] ?? '')
    .filter((s) => s.startsWith('.'))
    .map((s) => resolve(dirname(file), s).replace(/\.(js|ts)$/, ''))
}

describe('only the client reaches request.ts, only request.ts reaches lookup.ts [SPEC 14 1.43 K-4, R2-3]', () => {
  const all = sourceFiles(srcRoot)
  const guarded = [
    { module: join(folder, 'request'), only: join(folder, 'client.ts') },
    { module: join(folder, 'lookup'), only: join(folder, 'request.ts') },
  ]

  it('finds the source files and the client among them', () => {
    expect(all).toContain(join(folder, 'client.ts'))
    expect(namedModules(join(folder, 'client.ts'))).toContain(join(folder, 'request'))
  })

  it.each(guarded)('no file but $only imports $module', ({ module, only }) => {
    const importers = all.filter((file) => namedModules(file).includes(module))
    expect(importers).toEqual([only])
  })

  it.each([
    ['client', clientModule],
    ['index', indexModule],
  ])('%s.ts exports neither send nor openConnection', (name, loaded) => {
    expect(Object.keys(loaded)).not.toContain('send')
    expect(Object.keys(loaded)).not.toContain('openConnection')
    expect(source(`${name}.ts`)).not.toMatch(
      /export\s*\*|export\s*\{[^}]*\b(send|openConnection)\b/,
    )
  })
})
