import { describe, it, expect, afterEach } from 'vitest'
import { makeBusFixture, setValueHandler } from './test-bus'

let fixture: ReturnType<typeof makeBusFixture> | undefined
afterEach(() => fixture?.cleanup())

function setupAsk() {
  const asked: string[] = []
  fixture = makeBusFixture([setValueHandler('variant.delete')], async (req) => {
    asked.push(req.command)
    return true
  })
  return { f: fixture, asked }
}

const agent = { actor: 'agent' as const }

describe('command bus order: deny, validate, find project, ask, run [SPEC 3.6]', () => {
  it('returns INVALID_INPUT for an ask command with bad input, without asking the user', async () => {
    const { f, asked } = setupAsk()
    const result = await f.bus.execute('variant.delete', { projectId: f.projectId }, agent)
    expect(result).toMatchObject({ ok: false, error: { code: 'INVALID_INPUT' } })
    expect(asked).toEqual([])
  })

  it('returns NOT_FOUND for an ask command naming a project that is not open, without asking', async () => {
    const { f, asked } = setupAsk()
    const result = await f.bus.execute(
      'variant.delete',
      { projectId: 'not-open', value: 'a' },
      agent,
    )
    expect(result).toMatchObject({ ok: false, error: { code: 'NOT_FOUND' } })
    expect(asked).toEqual([])
  })

  it('returns AGENT_DENIED for a deny command before it validates the input', async () => {
    fixture = makeBusFixture([setValueHandler('settings.update')])
    const result = await fixture.bus.execute('settings.update', { nonsense: true }, agent)
    expect(result).toMatchObject({ ok: false, error: { code: 'AGENT_DENIED' } })
  })

  it('asks once the input is valid and the project is open', async () => {
    const { f, asked } = setupAsk()
    const result = await f.bus.execute(
      'variant.delete',
      { projectId: f.projectId, value: 'a' },
      agent,
    )
    expect(result.ok).toBe(true)
    expect(asked).toEqual(['variant.delete'])
  })
})
