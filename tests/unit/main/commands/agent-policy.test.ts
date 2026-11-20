import { describe, it, expect } from 'vitest'
import {
  AGENT_POLICY,
  agentPolicyFor,
  denialMessage,
} from '../../../../src/main/commands/agent-policy'

// SPEC 4.2, copied row by row. A change here must follow a change in SPEC.md.
const SPEC_4_2: Record<string, 'allow' | 'ask' | 'deny'> = {
  'project.create': 'deny',
  'project.open': 'deny',
  'project.close': 'deny',
  'project.setAssetsDir': 'deny',
  'project.package': 'deny',
  'subject.create': 'deny',
  'subject.update': 'deny',
  'subject.delete': 'deny',
  'asset.import': 'deny',
  'asset.update': 'deny',
  'asset.relink': 'deny',
  'asset.remove': 'deny',
  'brief.parse': 'deny',
  'campaign.create': 'allow',
  'campaign.update': 'deny',
  'campaign.delete': 'ask',
  'ruleSet.update': 'deny',
  'ruleSet.copyFrom': 'deny',
  'direction.createFromMaster': 'deny',
  'direction.rename': 'deny',
  'direction.delete': 'deny',
  'variant.fanOut': 'deny',
  'variant.add': 'allow',
  'variant.update': 'allow',
  'variant.delete': 'ask',
  'variant.setFormat': 'deny',
  'layer.create': 'allow',
  'layer.update': 'allow',
  'layer.delete': 'allow',
  'layer.reorder': 'allow',
  'layer.clearOverride': 'deny',
  'layer.reportOverflow': 'deny',
  'clip.add': 'deny',
  'clip.update': 'deny',
  'clip.remove': 'deny',
  'translation.propose': 'deny',
  'translation.set': 'allow',
  'translation.approve': 'deny',
  'translation.exportSheet': 'deny',
  'sync.apply': 'deny',
  'check.run': 'allow',
  'generation.runImages': 'deny',
  'generation.runFill': 'deny',
  'generation.proposeLayout': 'deny',
  'generation.copyOptions': 'deny',
  'generation.startVideo': 'deny',
  'job.retry': 'deny',
  'job.cancel': 'deny',
  'export.run': 'deny',
  'publish.run': 'deny',
  'history.undo': 'deny',
  'history.redo': 'deny',
  'settings.update': 'deny',
  'secret.set': 'deny',
  'secret.delete': 'deny',
  'mcp.setEnabled': 'deny',
  'mcp.regenerateToken': 'deny',
  'agent.answerPermission': 'deny',
}

describe('agent policy table [SPEC 4.2, ADR-009]', () => {
  it('lists every command in Section 4.2 with its policy, and nothing else', () => {
    expect(Object.fromEntries(Object.entries(AGENT_POLICY).map(([k, v]) => [k, v.policy]))).toEqual(
      SPEC_4_2,
    )
  })

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
