// Single owner of the agent policy (SPEC 3.1, 4.2, ADR-009).
// Allowing a deferred ability later (FR-199) is a change to this table only.
// [1.24] tick: allowed only while the user's tick for the provider is on (SPEC 6.11.3).
export type AgentPolicy = 'allow' | 'ask' | 'deny' | 'tick'

type Entry = { policy: AgentPolicy; action: string }

const allow = (action: string): Entry => ({ policy: 'allow', action })
const ask = (action: string): Entry => ({ policy: 'ask', action })
const deny = (action: string): Entry => ({ policy: 'deny', action })
const tick = (action: string): Entry => ({ policy: 'tick', action })

export const AGENT_POLICY: Record<string, Entry> = {
  'project.create': deny('create projects'),
  'project.open': deny('open projects'),
  'project.close': deny('close projects'),
  // Round 2 (D8): a new project in the default folder only; the input names no place.
  'project.createInDefaultFolder': allow('create projects'),
  'project.setAssetsDir': deny('change the assets folder'),
  'project.package': deny('package projects'),
  'subject.create': deny('create subjects'),
  'subject.update': deny('change subjects'),
  'subject.delete': ask('delete subjects'),
  'asset.import': deny('import files'),
  'asset.update': deny('change assets'),
  'asset.relink': deny('relink files'),
  'asset.remove': deny('remove assets'),
  'asset.addGenerated': deny('add generated files'),
  'asset.checkChanged': deny('check files for changes'),
  // Round 2 (D5, D7): an agent's import by full path, always through the dialog.
  'asset.importFiles': ask('import files'),
  'brief.parse': deny('read brief files'),
  // P4-1: brief.extract reads a path, so it is denied as brief.parse is.
  'brief.extract': deny('read brief files'),
  'campaign.create': allow('create campaigns'),
  'campaign.update': deny('change campaign settings'),
  'campaign.delete': ask('delete campaigns'),
  // Round 2 (D6): one handler, two names; the one that imports files asks.
  'campaign.createFromBrief': allow('make campaigns from a brief'),
  'campaign.createFromBriefWithFiles': ask('make campaigns that import files'),
  'ruleSet.update': deny('change rule sets'),
  'ruleSet.copyFrom': deny('copy rule sets'),
  'direction.createFromMaster': deny('create directions'),
  'direction.rename': deny('rename directions'),
  'direction.delete': deny('delete directions'),
  // P5-1: system commands, only inverses; deny and internal.
  'variant.fanOut': deny('run fan-out'),
  'variant.add': allow('add variants'),
  'variant.update': allow('change variants'),
  'variant.delete': ask('delete variants'),
  'variant.remove': deny('remove variants'),
  'variant.restore': deny('restore variants'),
  'variant.restoreLayers': deny('restore variant layers'),
  'variant.setFormat': allow('change a variant format'),
  // P7-1 (A-184).
  'variant.setSound': deny('change a variant sound'),
  'layer.create': allow('create layers'),
  'layer.update': allow('change layers'),
  'layer.updateMany': allow('change layers'),
  'layer.delete': allow('delete layers'),
  'layer.reorder': allow('reorder layers'),
  'layer.restore': deny('restore layers'),
  'layer.clearOverride': deny('clear overrides'),
  'layer.revert': deny('revert layers'),
  'layer.reportOverflow': deny('report text overflow'),
  // P6-1 (A-166): a font per language, as layer.update.
  'layer.setFonts': allow('set fonts per language'),
  'clip.add': deny('add background clips'),
  'clip.update': deny('change background clips'),
  'clip.remove': deny('remove background clips'),
  // P7-1: the track order, and the two system commands (deny and internal).
  'clip.reorder': deny('reorder background clips'),
  'clip.restore': deny('restore background clips'),
  'clip.addGenerated': deny('add generated clips'),
  'clip.swap': deny('swap background clips'),
  'translation.propose': deny('start AI translation'),
  'translation.set': allow('set translations'),
  'translation.approve': deny('approve translations'),
  'translation.exportSheet': deny('export translation sheets'),
  // P6-1: system commands (the job's write, the inverse of set and approve); deny and internal.
  'translation.write': deny('write AI translations'),
  'translation.restore': deny('restore translations'),
  'sync.apply': deny('sync variants'),
  'check.run': allow('run checks'),
  'generation.runImages': tick('start image generation'),
  'generation.runFill': tick('start generative fill'),
  'generation.proposeLayout': tick('start AI layout'),
  'generation.copyOptions': tick('start AI copy suggestions'),
  'generation.cutOut': tick('start cut-outs'),
  'generation.startVideo': tick('start video generation'),
  'generation.applyFill': deny('place fills'),
  'job.retry': deny('retry jobs'),
  'job.cancel': tick('cancel jobs'),
  'job.markSeen': deny('mark jobs as seen'),
  'export.run': deny('export'),
  // P8-1: system command, the export job's report row; deny and internal.
  'report.add': deny('save reports'),
  'publish.run': deny('publish'),
  // P9-9 (A-260): this machine's consent to share a font.
  'publish.setFontConsent': deny('share a font'),
  'history.undo': deny('undo'),
  'history.redo': deny('redo'),
  'settings.update': deny('change settings'),
  'secret.set': deny('change keys'),
  'secret.delete': deny('change keys'),
  'storage.dropboxSignIn': deny('sign in to Dropbox'),
  'storage.dropboxSignOut': deny('sign out of Dropbox'),
  'storage.checkS3': deny('test the cloud storage connection'),
  // P9-1 (A-213): the one writer of the Dropbox folder.
  'storage.setDropboxFolder': deny('change the Dropbox folder'),
  'mcp.setEnabled': deny('change agent access'),
  'mcp.regenerateToken': deny('change agent access'),
  'agent.answerPermission': deny('answer permission requests'),
  'comfy.setAddress': deny('change the ComfyUI address'),
  'comfy.check': deny('check the ComfyUI server'),
  // D-104, CW-2: all four deny for now; CW-6a turns add and remove to ask.
  'comfyWorkflow.addFromFile': deny('add ComfyUI workflows from a file'),
  'comfyWorkflow.add': deny('add ComfyUI workflows'),
  'comfyWorkflow.update': deny('change ComfyUI workflows'),
  'comfyWorkflow.remove': deny('remove ComfyUI workflows'),
  'agentRuns.setAllowed': deny('change which runs agents may start'),
  'agentRuns.setLimit': deny('change agent run limits'),
  'dev.comfyExtend': deny('use the hand-test tools'),
  // spec/approvals.md: approvals publish work outside the machine and hold other people's
  // email addresses, so every command is deny.
  'approvals.setService': deny('change the approvals service'),
  'approvals.check': deny('check the approvals service'),
  'approvals.createLink': deny('make approval links'),
  'approvals.setPassword': deny('change approval link passwords'),
  'approvals.publish': deny('update approval galleries'),
  'approvals.refresh': deny('refresh approvals'),
  'approvals.endLink': deny('turn off approval links'),
  'approvals.cancelUpdate': deny('stop approval gallery updates'),
}

// The policy the bus applies. A tick row goes to the agent run gate (agent-run-gate.ts).
export function agentPolicyFor(command: string): AgentPolicy {
  return AGENT_POLICY[command]?.policy ?? 'deny'
}

export function denialMessage(command: string): string {
  const action = AGENT_POLICY[command]?.action ?? 'do this'
  return `Agents cannot ${action} in this version. Ask the user to do it in the app.`
}
