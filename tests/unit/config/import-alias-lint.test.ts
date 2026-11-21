import { describe, it, expect } from 'vitest'
import { ESLint } from 'eslint'

const eslint = new ESLint()

async function messages(code: string, filePath: string): Promise<string[]> {
  const [result] = await eslint.lintText(code, { filePath })
  return (result?.messages ?? [])
    .filter((m) => m.ruleId === 'no-restricted-imports')
    .map((m) => m.message)
}

const climbing = "import { x } from '../shared/x'\nexport { x }\n"
const aliased = "import { x } from '@/shared/x'\nexport { x }\n"

// One file per lint block under src/ (structure.md, LO-1a).
const filesByBlock = [
  'src/main/core.ts',
  'src/main/commands/a.ts',
  'src/main/commands/project/a.ts',
  'src/shared/a.ts',
  'src/renderer/screens/a.tsx',
  'src/preload/index.ts',
  'src/main/index.ts',
  'src/main/windows/dialogs.ts',
  'src/main/secrets/safe-storage.ts',
  'src/main/render/service.ts',
]

describe('src/ imports climb through @/, never ../ [structure.md, LO-1a]', () => {
  it('refuses a ../ import in every block under src/', async () => {
    for (const file of filesByBlock) {
      expect(await messages(climbing, file), file).not.toEqual([])
    }
  })

  it('accepts the same import through @/', async () => {
    for (const file of filesByBlock) {
      expect(await messages(aliased, file), file).toEqual([])
    }
  })

  it('keeps the area rules for @/ paths', async () => {
    const cases: Array<[string, string]> = [
      ['src/renderer/a.ts', "import { x } from '@/main/x'\nexport { x }\n"],
      ['src/renderer/a.ts', "import { x } from '@/preload/x'\nexport { x }\n"],
      ['src/shared/a.ts', "import { x } from '@/renderer/x'\nexport { x }\n"],
      ['src/main/core.ts', "import { x } from '@/main/windows/dialogs'\nexport { x }\n"],
      ['src/main/commands/a.ts', "import { x } from '@/main/render/service'\nexport { x }\n"],
      [
        'src/main/queries/a/b.ts',
        "import { x } from '@/main/secrets/safe-storage'\nexport { x }\n",
      ],
      ['src/main/queries/a.ts', "import { x } from '@/main/index'\nexport { x }\n"],
    ]
    for (const [file, code] of cases) {
      expect(await messages(code, file), `${file}: ${code}`).not.toEqual([])
    }
  })

  it('still refuses electron where it refused it before', async () => {
    const code = "import { app } from 'electron'\nexport { app }\n"
    expect(await messages(code, 'src/main/core.ts')).not.toEqual([])
    expect(await messages(code, 'src/renderer/a.ts')).not.toEqual([])
  })
})
