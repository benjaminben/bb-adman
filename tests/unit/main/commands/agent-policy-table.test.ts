import { describe, it, expect } from 'vitest'
import { AGENT_POLICY, agentPolicyFor } from '../../../../src/main/commands/agent-policy'

// SPEC 1.9 Section 4.2, copied row by row. variant.setFormat is allow [D-025].
// A change here must follow a change in SPEC.md.
const SPEC_4_2: Record<string, 'allow' | 'ask' | 'deny' | 'tick'> = {
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
  'asset.addGenerated': 'deny',
  'asset.checkChanged': 'deny',
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
  'variant.setFormat': 'allow',
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
  'generation.runImages': 'tick',
  'generation.runFill': 'tick',
  'generation.proposeLayout': 'deny',
  'generation.copyOptions': 'deny',
  'generation.startVideo': 'tick',
  'job.retry': 'deny',
  'job.cancel': 'tick',
  'job.markSeen': 'deny',
  'export.run': 'deny',
  'publish.run': 'deny',
  'history.undo': 'deny',
  'history.redo': 'deny',
  'settings.update': 'deny',
  'secret.set': 'deny',
  'secret.delete': 'deny',
  'storage.dropboxSignIn': 'deny',
  'storage.dropboxSignOut': 'deny',
  'dev.storage': 'deny',
  'mcp.setEnabled': 'deny',
  'mcp.regenerateToken': 'deny',
  'agent.answerPermission': 'deny',
  'comfy.setAddress': 'deny',
  'comfy.check': 'deny',
  'agentRuns.setAllowed': 'deny',
  'dev.comfyExtend': 'deny',
}

describe('agent policy table, SPEC 1.9 [SPEC 4.2, ADR-009, D-025]', () => {
  it('lists every command in Section 4.2 with its policy, and nothing else', () => {
    expect(Object.fromEntries(Object.entries(AGENT_POLICY).map(([k, v]) => [k, v.policy]))).toEqual(
      SPEC_4_2,
    )
  })

  it('lets an agent run variant.setFormat without the permission dialog [D-025]', () => {
    expect(agentPolicyFor('variant.setFormat')).toBe('allow')
  })
})
