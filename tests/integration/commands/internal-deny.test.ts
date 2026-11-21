// Security guard: a system (internal) command takes values the main process wrote, so no
// agent may call one. Every registered internal command has agent policy deny.
import { describe, it, expect, afterEach } from 'vitest'
import { makeFixture, type Fixture } from '../core-fixture'
import { AGENT_POLICY } from '@/main/commands/agent-policy'

let f: Fixture
afterEach(() => f.cleanup())

describe('internal commands and the agent', () => {
  it('denies the agent every internal command', () => {
    f = makeFixture()
    const internal = f.core.commandNames.filter((name) => f.core.isInternal(name))
    expect(internal.length).toBeGreaterThan(0)
    for (const name of internal) expect(AGENT_POLICY[name]?.policy, name).toBe('deny')
  })
})
