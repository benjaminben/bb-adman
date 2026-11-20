import { describe, it, expect } from 'vitest'
import { ESLint } from 'eslint'
import * as prettier from 'prettier'

const eslint = new ESLint()

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'parse')
}

describe('code rules [SPEC 12]', () => {
  it('rejects a source file longer than 300 lines', async () => {
    const code =
      Array.from({ length: 301 }, (_, i) => `export const v${i} = ${i}`).join('\n') + '\n'
    expect(await ruleIds(code, 'src/main/long.ts')).toContain('max-lines')
  })

  it('accepts a source file of exactly 300 lines', async () => {
    const code = Array.from({ length: 300 }, (_, i) => `export const v${i} = ${i}`).join('\n')
    expect(await ruleIds(code, 'src/main/ok.ts')).not.toContain('max-lines')
  })

  it('flags semicolons through the Prettier check', async () => {
    const options = await prettier.resolveConfig('src/main/x.ts')
    const formatted = await prettier.check('export const a = 1;\n', {
      ...options,
      filepath: 'src/main/x.ts',
    })
    expect(formatted).toBe(false)
    const clean = await prettier.check('export const a = 1\n', {
      ...options,
      filepath: 'src/main/x.ts',
    })
    expect(clean).toBe(true)
  })

  it('rejects explicit any outside tests', async () => {
    expect(await ruleIds('export const a: any = 1\n', 'src/main/a.ts')).toContain(
      '@typescript-eslint/no-explicit-any',
    )
  })
})

describe('module rules [SPEC 12]', () => {
  it('forbids Electron and Node imports in src/shared', async () => {
    expect(
      await ruleIds("import { app } from 'electron'\nexport { app }\n", 'src/shared/a.ts'),
    ).toContain('no-restricted-imports')
    expect(await ruleIds("import fs from 'node:fs'\nexport { fs }\n", 'src/shared/a.ts')).toContain(
      'no-restricted-imports',
    )
  })

  it('forbids main-process imports in src/shared and src/renderer', async () => {
    const code = "import { x } from '../main/x'\nexport { x }\n"
    expect(await ruleIds(code, 'src/shared/a.ts')).toContain('no-restricted-imports')
    expect(await ruleIds(code, 'src/renderer/a.ts')).toContain('no-restricted-imports')
  })

  it('bans path.join with asset path fields outside the path resolver', async () => {
    const code =
      "import path from 'node:path'\nexport const p = (a: { rel_path: string }) => path.join('x', a.rel_path)\n"
    expect(await ruleIds(code, 'src/main/assets/import.ts')).toContain('no-restricted-syntax')
    expect(await ruleIds(code, 'src/main/assets/path-resolver.ts')).not.toContain(
      'no-restricted-syntax',
    )
  })
})
