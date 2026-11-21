import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { srcAlias } from '../../../path-alias.config'

const tsconfig = JSON.parse(fs.readFileSync('tsconfig.json', 'utf8')) as {
  compilerOptions: { paths?: Record<string, string[]> }
}

describe('the @/ import alias has one owner [structure.md, LO-1a]', () => {
  it('srcAlias maps @ to the src folder', () => {
    expect(srcAlias['@']).toBe(path.resolve('src'))
  })

  it('tsconfig paths name the same folder as srcAlias', () => {
    const paths = tsconfig.compilerOptions.paths ?? {}
    expect(paths['@/*']).toEqual(['./src/*'])
    const target = (paths['@/*']?.[0] ?? '').replace(/\/\*$/, '')
    expect(path.resolve(target)).toBe(srcAlias['@'])
  })
})
