// The fixed table of MCP tools (SPEC 4.5; SPEC 14 1.56 MCP-B). Each tool runs one command
// or query named here; a tool name is never used as a command or query name. Only the 4.5
// tools whose command or query exists are listed. Each input is the command's or query's
// own Zod schema, with its top-level keys in snake_case (SPEC 4.5: project_id -> projectId).
import type { z } from 'zod'
import { campaignCreateInput } from '../../../shared/schemas/commands/campaign'
import { assetListInput, type AssetList } from '../../../shared/schemas/queries/asset'
import { campaignScopedInput, projectGetInput } from '../../../shared/schemas/queries/campaign'

export type ToolDef = {
  name: string
  description: string
  kind: 'command' | 'query'
  target: string
  input: z.ZodObject
  // Picks what the tool returns from the reply, where 4.5 gives fewer fields.
  reply?: (data: unknown) => unknown
}

// SPEC 4.5 list_assets and FR-198: the listed fields only, so no file path is returned.
function assetFields(data: unknown): unknown {
  return (data as AssetList).map((a) => ({
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
}

export const MCP_TOOLS: readonly ToolDef[] = [
  {
    name: 'get_project',
    description:
      'Read one project that is open in the app: its subjects and a summary of each ' +
      'campaign. Works only on open projects.',
    kind: 'query',
    target: 'project.get',
    input: projectGetInput,
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
]
