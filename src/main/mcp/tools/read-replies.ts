// Allow-list pickers for the MCP-D read tools (spec/mcp-and-agents.md, the tool table). Each
// names the fields that go out, so a field added to a reply later does not leave through MCP
// without a change here (FR-198).
import type { ProviderInfo } from '@/shared/schemas/queries/app'
import type { AssetList } from '@/shared/schemas/queries/asset'
import type { TemplateSlots } from '@/shared/schemas/queries/campaign'
import type { ProjectListOpen } from '@/shared/schemas/queries/project'
import type { JobList } from '@/shared/schemas/queries/job'
import type { JobRow } from '@/shared/schemas/rows/job'
import { agentJobView } from './agent-job-view'

// What a picker may use besides the reply: the provider labels, for a job's message.
export type ReplyContext = { providers: readonly Pick<ProviderInfo, 'id' | 'label'>[] }

export type ReplyPicker = (data: unknown, ctx: ReplyContext) => unknown

// list_assets and FR-198: the listed fields only, so no file path is returned.
export const assetFields: ReplyPicker = (data) =>
  (data as AssetList).map((a) => ({
    id: a.id,
    displayName: a.displayName,
    kind: a.kind,
    library: a.library,
    subjectId: a.subjectId,
    width: a.width,
    height: a.height,
    durationMs: a.durationMs,
    fontFamily: a.fontFamily,
  }))

// list_projects: ID and name; never the file path.
export const openProjectFields: ReplyPicker = (data) =>
  (data as ProjectListOpen).map((p) => ({ id: p.id, name: p.name }))

// get_slots: per slot of the master variant.
export const slotFields: ReplyPicker = (data) =>
  (data as TemplateSlots).map((s) => ({
    slotId: s.slot.id,
    type: s.slot.type,
    state: s.state,
    candidates: [...s.candidates],
  }))

export const jobFields: ReplyPicker = (data, ctx) => agentJobView(data as JobRow, ctx.providers)

export const jobListFields: ReplyPicker = (data, ctx) =>
  (data as JobList).map((row) => agentJobView(row, ctx.providers))
