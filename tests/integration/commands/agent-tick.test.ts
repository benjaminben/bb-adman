import { describe, it, expect, afterEach } from 'vitest'
import { makeBusFixture, setValueHandler } from './test-bus'
import { AGENT_POLICY, agentPolicyFor } from '../../../src/main/commands/agent-policy'

let fixture: ReturnType<typeof makeBusFixture> | undefined
afterEach(() => fixture?.cleanup())

const TICK_COMMANDS = [
  'generation.runImages',
  'generation.runFill',
  'generation.startVideo',
  'job.cancel',
]

describe('the agent policy value tick, held as deny until CU-7 [SPEC 6.11.3, 14 CU-0]', () => {
  for (const name of TICK_COMMANDS) {
    it(`${name} is tick in the table and deny to the bus`, () => {
      expect(AGENT_POLICY[name]?.policy).toBe('tick')
      expect(agentPolicyFor(name)).toBe('deny')
    })

    it(`refuses ${name} from an agent with AGENT_DENIED before the handler runs`, async () => {
      fixture = makeBusFixture([setValueHandler(name)])
      const f = fixture
      const input = { projectId: f.projectId, value: 'a' }
      expect(await f.bus.execute(name, input, { actor: 'agent' })).toMatchObject({
        ok: false,
        error: { code: 'AGENT_DENIED', message: expect.stringMatching(/^Agents cannot/) },
      })
      expect(f.value()).toBeNull()
      expect(await f.bus.execute(name, input, { actor: 'user' })).toMatchObject({ ok: true })
      expect(f.value()).toBe('a')
    })
  }
})
