import { describe, it, expect } from 'vitest'
import { ESLint } from 'eslint'

const eslint = new ESLint()

async function ruleIds(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? []).map((m) => m.ruleId ?? 'parse')
}

const electronImport = "import { app } from 'electron'\nexport { app }\n"

describe('Electron stays at the edge [SPEC 12]', () => {
  it('forbids importing electron in main-process files that core.ts can reach', async () => {
    for (const file of [
      'src/main/core.ts',
      'src/main/core-deps.ts',
      'src/main/commands/project/open.ts',
      'src/main/db/project-file.ts',
      'src/main/queries/app.ts',
      'src/main/secrets/secret-store.ts',
    ]) {
      expect(await ruleIds(electronImport, file), file).toContain('no-restricted-imports')
    }
  })

  it('allows electron in index.ts, windows/, secrets/safe-storage.ts and render/', async () => {
    for (const file of [
      'src/main/index.ts',
      'src/main/windows/dialogs.ts',
      'src/main/secrets/safe-storage.ts',
      'src/main/render/service.ts',
    ]) {
      expect(await ruleIds(electronImport, file), file).not.toContain('no-restricted-imports')
    }
  })

  it('forbids core-side files from importing the files that hold electron', async () => {
    const cases: Array<[string, string]> = [
      ['src/main/core.ts', "import { x } from './windows/dialogs'\nexport { x }\n"],
      ['src/main/core.ts', "import { x } from './secrets/safe-storage'\nexport { x }\n"],
      ['src/main/commands/a.ts', "import { x } from '../render/service'\nexport { x }\n"],
      ['src/main/queries/a.ts', "import { x } from '../index'\nexport { x }\n"],
    ]
    for (const [file, code] of cases) {
      expect(await ruleIds(code, file), `${file}: ${code}`).toContain('no-restricted-imports')
    }
  })
})
