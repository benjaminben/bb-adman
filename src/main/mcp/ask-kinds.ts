// The kind of each ask (spec/phases/round-2-platform.md, D7), its one owner. Every command whose
// agent policy is ask is listed here; the kind picks the dialog the window draws and whether
// mcp.autoApproveDestructive may answer it (deletes only, from R2P-5).
import type { EventMap } from '@/shared/schemas/events'

export type AskKind = EventMap['agent.permissionRequested']['kind']

export const ASK_KINDS: Readonly<Record<string, AskKind>> = {
  'campaign.delete': 'delete',
  'variant.delete': 'delete',
  'subject.delete': 'delete',
  'asset.importFiles': 'import',
  'campaign.createFromBriefWithFiles': 'import',
}
