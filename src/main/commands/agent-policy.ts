// Single owner of the agent policy (SPEC 3.1, 4.2, ADR-009).
// Allowing a deferred ability later (FR-199) is a change to this table only.
export type AgentPolicy = 'allow' | 'ask' | 'deny'

type Entry = { policy: AgentPolicy; action: string }

const allow = (action: string): Entry => ({ policy: 'allow', action })
const ask = (action: string): Entry => ({ policy: 'ask', action })
const deny = (action: string): Entry => ({ policy: 'deny', action })

export const AGENT_POLICY: Record<string, Entry> = {
  'project.create': deny('create projects'),
  'project.open': deny('open projects'),
  'project.close': deny('close projects'),
  'project.setAssetsDir': deny('change the assets folder'),
  'project.package': deny('package projects'),
  'subject.create': deny('create subjects'),
  'subject.update': deny('change subjects'),
  'subject.delete': deny('delete subjects'),
  'asset.import': deny('import files'),
  'asset.update': deny('change assets'),
  'asset.relink': deny('relink files'),
  'asset.remove': deny('remove assets'),
  'brief.parse': deny('read brief files'),
  'campaign.create': allow('create campaigns'),
  'campaign.update': deny('change campaign settings'),
  'campaign.delete': ask('delete campaigns'),
  'ruleSet.update': deny('change rule sets'),
  'ruleSet.copyFrom': deny('copy rule sets'),
  'direction.createFromMaster': deny('create directions'),
  'direction.rename': deny('rename directions'),
  'direction.delete': deny('delete directions'),
  'variant.fanOut': deny('run fan-out'),
  'variant.add': allow('add variants'),
  'variant.update': allow('change variants'),
  'variant.delete': ask('delete variants'),
  'variant.setFormat': deny('change a variant format'),
  'layer.create': allow('create layers'),
  'layer.update': allow('change layers'),
  'layer.delete': allow('delete layers'),
  'layer.reorder': allow('reorder layers'),
  'layer.clearOverride': deny('clear overrides'),
  'layer.reportOverflow': deny('report text overflow'),
  'clip.add': deny('add background clips'),
  'clip.update': deny('change background clips'),
  'clip.remove': deny('remove background clips'),
  'translation.propose': deny('start AI translation'),
  'translation.set': allow('set translations'),
  'translation.approve': deny('approve translations'),
  'translation.exportSheet': deny('export translation sheets'),
  'sync.apply': deny('sync variants'),
  'check.run': allow('run checks'),
  'generation.runImages': deny('start image generation'),
  'generation.runFill': deny('start generative fill'),
  'generation.proposeLayout': deny('start AI layout'),
  'generation.copyOptions': deny('start AI copy suggestions'),
  'generation.startVideo': deny('start video generation'),
  'job.retry': deny('retry jobs'),
  'job.cancel': deny('cancel jobs'),
  'export.run': deny('export'),
  'publish.run': deny('publish'),
  'history.undo': deny('undo'),
  'history.redo': deny('redo'),
  'settings.update': deny('change settings'),
  'secret.set': deny('change keys'),
  'secret.delete': deny('change keys'),
  'mcp.setEnabled': deny('change agent access'),
  'mcp.regenerateToken': deny('change agent access'),
  'agent.answerPermission': deny('answer permission requests'),
}

export function agentPolicyFor(command: string): AgentPolicy {
  return AGENT_POLICY[command]?.policy ?? 'deny'
}

export function denialMessage(command: string): string {
  const action = AGENT_POLICY[command]?.action ?? 'do this'
  return `Agents cannot ${action} in this version. Ask the user to do it in the app.`
}
