// The fixed table of MCP tools (SPEC 4.5; SPEC 14 1.56 MCP-B; MCP-D). Each tool runs one
// command or query named here; a tool name is never used as a command or query name. Only the
// 4.5 tools whose command or query exists are listed. Each input is the command's or query's
// own Zod schema, with its top-level keys in snake_case (SPEC 4.5: project_id -> projectId).
// Every reply goes through an allow-list picker (spec/mcp-and-agents.md, rules for every tool).
// ALL_TOOLS is the Phase 10 plan (A-230): the built tools, then one group file per slice. A
// notBuilt row is left out of MCP_TOOLS, so it is never listed to an agent.
import type { z } from 'zod'
import { assetListInput } from '@/shared/schemas/queries/asset'
import { campaignScopedInput, projectGetInput } from '@/shared/schemas/queries/campaign'
import { jobGetInput, jobListInput } from '@/shared/schemas/queries/job'
import { projectListOpenInput } from '@/shared/schemas/queries/project'
import {
  assetFields,
  jobFields,
  jobListFields,
  openProjectFields,
  slotFields,
  type ReplyPicker,
} from './read-replies'
import { campaignFields, projectFields } from './project-replies'
import { RUN_TOOLS } from './run-tools'
import { CAMPAIGN_TOOLS } from './campaign-tool'
import { READ_MORE_TOOLS } from './read-more-tools'
import { RENDER_TOOLS } from './render-tool'
import { LAYER_TOOLS } from './layer-tools'
import { AI_TOOLS } from './ai-tools'
import { DELETE_TOOLS } from './delete-tools'
import { VARIANT_EDIT_TOOLS } from './variant-edit-tools'
import { TRANSLATION_CHECK_TOOLS } from './translation-check-tools'
import { FORMAT_TOOLS } from './format-tool'

export type ToolDef = {
  name: string
  description: string
  kind: 'command' | 'query'
  target: string
  input: z.ZodObject
  // Picks what the tool returns from the reply, where 4.5 gives fewer fields.
  reply?: ReplyPicker
  // MCP-G: runs through the one serial toolSetup shares with every session.
  oneAtATime?: boolean
  // A-230: in the plan, not registered with the MCP server until its slice fills the row.
  notBuilt?: true
  // 'png': the reply is one MCP image item of data.png and nothing else (A-234). Default json.
  content?: 'json' | 'png'
  // Runs on the camelCase input, after the snake_case mapping, before the call (A-246).
  prepareInput?: (input: Record<string, unknown>) => Record<string, unknown>
}

export const ALL_TOOLS: readonly ToolDef[] = [
  {
    name: 'list_projects',
    description:
      'List the projects open in the app, with the ID and name of each. Use an ID as ' +
      'project_id in the other tools.',
    kind: 'query',
    target: 'project.listOpen',
    input: projectListOpenInput,
    reply: openProjectFields,
  },
  {
    name: 'get_project',
    description:
      'Read one project that is open in the app: its subjects and a summary of each ' +
      'campaign. Works only on open projects.',
    kind: 'query',
    target: 'project.get',
    input: projectGetInput,
    reply: projectFields,
  },
  {
    name: 'list_assets',
    description:
      'List the assets of an open project, optionally by library, kind or subject. Gives ' +
      'id, display name, kind, library, subject ID, width, height, duration and font family.',
    kind: 'query',
    target: 'asset.list',
    input: assetListInput,
    reply: assetFields,
  },
  {
    name: 'get_campaign',
    description:
      'Read one campaign of an open project: its fields, rule set, directions and a ' +
      'summary of each variant with its badges.',
    kind: 'query',
    target: 'campaign.get',
    input: campaignScopedInput,
    reply: campaignFields,
  },
  ...CAMPAIGN_TOOLS,
  {
    name: 'get_slots',
    description:
      "Read the slots of a campaign's master variant: for each, its slot ID, type, whether " +
      'it is filled or empty, and the IDs of the assets that could fill it.',
    kind: 'query',
    target: 'template.slots',
    input: campaignScopedInput,
    reply: slotFields,
  },
  {
    name: 'get_job',
    description:
      'Read one run (job) of an open project: its status, progress, the asset IDs it made, ' +
      'layout for a propose_layout run and copyOptions for a copy_options run once it has ' +
      'succeeded, and, when it failed, a plain message. Poll no more than once every 5 seconds.',
    kind: 'query',
    target: 'job.get',
    input: jobGetInput,
    reply: jobFields,
  },
  {
    name: 'list_jobs',
    description:
      'List the runs (jobs) of an open project, newest first, optionally by campaign, ' +
      'variant or state (active, unseen or failed), up to limit (default 200).',
    kind: 'query',
    target: 'job.list',
    input: jobListInput.omit({ layerId: true }),
    reply: jobListFields,
  },
  ...RUN_TOOLS,
  ...READ_MORE_TOOLS,
  ...RENDER_TOOLS,
  ...LAYER_TOOLS,
  ...AI_TOOLS,
  ...DELETE_TOOLS,
  ...VARIANT_EDIT_TOOLS,
  ...TRANSLATION_CHECK_TOOLS,
  ...FORMAT_TOOLS,
]

// What core registers: every built row, in the same order.
export const MCP_TOOLS: readonly ToolDef[] = ALL_TOOLS.filter((t) => !t.notBuilt)
