import fs from 'node:fs'
import { describe, it, expect } from 'vitest'

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8')) as {
  allowScripts: Record<string, boolean>
}

describe('install scripts [SPEC 7.5, correction 26]', () => {
  it('denies fsevents@2.3.3 explicitly', () => {
    expect(pkg.allowScripts['fsevents@2.3.3']).toBe(false)
  })

  it('allows only the scripts the architect has recorded (OI-27)', () => {
    const allowed = Object.entries(pkg.allowScripts)
      .filter(([, run]) => run)
      .map(([name]) => name)
      .sort()
    expect(allowed).toEqual([
      'electron-winstaller@5.4.0',
      'esbuild@0.18.20',
      'esbuild@0.25.12',
      'esbuild@0.28.2',
    ])
  })
})
