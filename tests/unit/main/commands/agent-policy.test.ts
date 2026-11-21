import { describe, it, expect } from 'vitest'
import { agentPolicyFor, denialMessage } from '@/main/commands/agent-policy'

describe('agent policy table [SPEC 4.2, ADR-009]', () => {
  it('treats an unknown command as deny', () => {
    expect(agentPolicyFor('nope.nothing')).toBe('deny')
  })

  it('gives a plain sentence for each denied generation, export and publish command [workflow 5.7]', () => {
    expect(denialMessage('generation.runImages')).toBe(
      'Agents cannot start image generation in this version. Ask the user to do it in the app.',
    )
    expect(denialMessage('export.run')).toMatch(/^Agents cannot export/)
    expect(denialMessage('publish.run')).toMatch(/^Agents cannot publish/)
    expect(denialMessage('secret.set')).toMatch(/Ask the user/)
  })
})
