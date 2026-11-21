import { describe, it, expect, afterEach, vi } from 'vitest'
import { makeBusFixture, setValueHandler } from './test-bus'
import { denialMessage, type AgentPolicy } from '../../../src/main/commands/agent-policy'

// The policy the bus reads for the test command, replaced for this file only (SPEC 14 1.37 X2).
const NAME = 'test.failClosed'
const policy = vi.hoisted(() => ({ value: 'deny' as string }))

vi.mock('../../../src/main/commands/agent-policy', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../src/main/commands/agent-policy')>()
  return {
    ...real,
    agentPolicyFor: (name: string) =>
      name === NAME ? (policy.value as AgentPolicy) : real.agentPolicyFor(name),
  }
})

let fixture: ReturnType<typeof makeBusFixture> | undefined
afterEach(() => fixture?.cleanup())

describe('the bus fails closed on an agent policy it does not run [SPEC 14 1.37 X2]', () => {
  const cases: { label: string; value: AgentPolicy }[] = [
    { label: 'a raw tick', value: 'tick' },
    { label: 'a made-up fifth value', value: 'maybe' as AgentPolicy },
  ]
  for (const { label, value } of cases) {
    it(`refuses ${label} from an agent with AGENT_DENIED, and runs it for the user`, async () => {
      policy.value = value
      fixture = makeBusFixture([setValueHandler(NAME)])
      const f = fixture
      const input = { projectId: f.projectId, value: 'a' }
      expect(await f.bus.execute(NAME, input, { actor: 'agent' })).toMatchObject({
        ok: false,
        error: { code: 'AGENT_DENIED', message: denialMessage(NAME) },
      })
      expect(f.value()).toBeNull()
      expect(await f.bus.execute(NAME, input, { actor: 'user' })).toMatchObject({ ok: true })
      expect(f.value()).toBe('a')
    })
  }

  it('still runs a command whose policy is allow for the agent', async () => {
    policy.value = 'allow'
    fixture = makeBusFixture([setValueHandler(NAME)])
    const f = fixture
    const input = { projectId: f.projectId, value: 'b' }
    expect(await f.bus.execute(NAME, input, { actor: 'agent' })).toMatchObject({ ok: true })
    expect(f.value()).toBe('b')
  })
})
