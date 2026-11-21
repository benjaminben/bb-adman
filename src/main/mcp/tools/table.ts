// The fixed table of MCP tools (SPEC 4.5; SPEC 14 1.56 MCP-B; MCP-D). Each tool runs one
// command or query named here; a tool name is never used as a command or query name. Only the
// 4.5 tools whose command or query exists are listed. Each input is the command's or query's
// own Zod schema, with its top-level keys in snake_case (SPEC 4.5: project_id -> projectId).
// Every reply goes through an allow-list picker (spec/mcp-and-agents.md, rules for every tool).
import type { z } from 'zod'
import { campaignCreateInput } from '@/shared/schemas/commands/campaign'
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
}

export const MCP_TOOLS: readonly ToolDef[] = [
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
  {
    name: 'create_campaign',
    description:
      'Create a campaign in an open project from a confirmed brief, with one subject_map ' +
      'entry per brief subject. Gives the new campaign ID and its master variant ID.',
    kind: 'command',
    target: 'campaign.create',
    input: campaignCreateInput,
  },
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
      'Read one run (job) of an open project: its status, progress, the asset IDs it made ' +
      'and, when it failed, a plain message. Poll no more than once every 5 seconds.',
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
]
