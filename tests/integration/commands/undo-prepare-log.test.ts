import { describe, it, expect, afterEach } from 'vitest'
import { z } from 'zod'
import { defineCommand } from '@/main/commands/types'
import { AppError } from '@/shared/schemas/result'
import { makeMultiBus } from './multi-bus'

let fixture: ReturnType<typeof makeMultiBus> | undefined
afterEach(() => fixture?.cleanup())

// A test-only two-step command whose run refuses and whose clean-up throws.
const broken = defineCommand({
  name: 'asset.import',
  input: z.object({ projectId: z.string() }),
  projectId: (i) => i.projectId,
  prepare: async () => 'prepared',
  run() {
    throw new AppError('RULE_VIOLATION', 'No.')
  },
  undoPrepare() {
    throw new Error('clean-up broke')
  },
})

describe('a failing undoPrepare is logged [SPEC 3.6, 9.1, correction 24]', () => {
  it('returns the error from run, and the log has one warn line with step undoPrepare and the same commandId', async () => {
    fixture = makeMultiBus({ count: 1, handlers: () => [broken] })
    const projectId = fixture.projects[0]?.projectId
    const result = await fixture.bus.execute('asset.import', { projectId }, { actor: 'user' })
    expect(result).toEqual({ ok: false, error: { code: 'RULE_VIOLATION', message: 'No.' } })

    const lines = fixture.logLines()
    const warn = lines.filter((l) => (l.context as { step?: string }).step === 'undoPrepare')
    expect(warn).toHaveLength(1)
    expect(warn[0]).toMatchObject({
      level: 'warn',
      event: 'command',
      name: 'asset.import',
      ok: false,
      errorKind: null,
      message: 'Clean-up after a failed command did not finish.',
      context: {
        step: 'undoPrepare',
        error: { name: 'Error', message: 'clean-up broke', stack: expect.any(String) },
      },
    })
    const commandLine = lines.find((l) => l.errorKind === 'RULE_VIOLATION')
    const id = (l: Record<string, unknown> | undefined) =>
      (l?.context as { commandId?: string } | undefined)?.commandId
    expect(id(warn[0])).toBeDefined()
    expect(id(warn[0])).toBe(id(commandLine))
  })
})
