import { describe, it, expect, afterEach } from 'vitest'
import { makeBusFixture, setValueHandler } from './test-bus'
import { AGENT_POLICY, agentPolicyFor, denialMessage } from '@/main/commands/agent-policy'

let fixture: ReturnType<typeof makeBusFixture> | undefined
afterEach(() => fixture?.cleanup())

const TICK_COMMANDS = [
  'generation.runImages',
  'generation.runFill',
  'generation.startVideo',
  'job.cancel',
]

// The gate cases for the three commands it knows are in agent-run-gate.test.ts and
// agent-run-cancel.test.ts (AR-1).
describe('the agent policy value tick goes to the gate [spec/agent-runs.md, AR-1]', () => {
  for (const name of TICK_COMMANDS) {
    it(`${name} is tick in the table and from agentPolicyFor`, () => {
      expect(AGENT_POLICY[name]?.policy).toBe('tick')
      expect(agentPolicyFor(name)).toBe('tick')
    })
  }

  it('refuses generation.runFill from an agent with its denial message; the user runs it', async () => {
    const name = 'generation.runFill'
    fixture = makeBusFixture([setValueHandler(name)])
    const f = fixture
    const input = { projectId: f.projectId, value: 'a' }
    expect(await f.bus.execute(name, input, { actor: 'agent' })).toEqual({
      ok: false,
      error: { code: 'AGENT_DENIED', message: denialMessage(name) },
    })
    expect(f.value()).toBeNull()
    expect(await f.bus.execute(name, input, { actor: 'user' })).toMatchObject({ ok: true })
    expect(f.value()).toBe('a')
  })
})
