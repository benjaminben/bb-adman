// S2-1 [F-11]: comfy-check-result.tsx takes its check sentences and missing-item text from
// their owners and holds no copy of its own.
import fs from 'node:fs'
import path from 'node:path'
import { describe, it, expect } from 'vitest'
import { checkMessage } from '@/shared/providers/messages'
import { COMFY_CHECK_OUTCOMES } from '@/shared/schemas/commands/comfy-check'

const SOURCE = fs.readFileSync(
  path.resolve('src/renderer/screens/settings/comfy-check-result/comfy-check-result.tsx'),
  'utf8',
)

const failures = COMFY_CHECK_OUTCOMES.filter((o) => o !== 'ok')

describe('comfy-check-result.tsx holds no check sentence [S2-1, F-11]', () => {
  it.each(failures)('holds no part of the %s sentence', (outcome) => {
    const parts = checkMessage(outcome)
      .split('{address}')
      .map((part) => part.trim())
      .filter((part) => part.length > 8)
    for (const part of parts) expect(SOURCE).not.toContain(part)
  })

  it('holds no missing-item text', () => {
    expect(SOURCE).not.toContain('in the folder')
    expect(SOURCE).not.toContain('ComfyUI version')
  })
})
