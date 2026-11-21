// MCP-G (security class): the tools that start and cancel runs (spec/mcp-and-agents.md, the
// tool table and "Notes on single tools"; spec/agent-runs.md). Each runs one command whose
// agent policy is tick, so the agent-run gate in the bus decides; nothing here checks a tick,
// a provider or a limit. The two start tools run one at a time (oneAtATime, toolSetup).
// Every reply is { jobId } only; a refusal is returned as the command gives it. The start
// tools do not offer licenceConfirmed: an agent cannot confirm a licence (S2-4).
import {
  generationRunImagesAgentInput,
  generationStartVideoAgentInput,
} from '@/shared/schemas/commands/generation'
import { jobCancelInput, type JobStarted } from '@/shared/schemas/commands/job'
import type { ReplyPicker } from './read-replies'
import type { ToolDef } from './table'
import { LEAVE_THE_CHOICE, PROVIDER_WORDS } from './tool-words'

// The one field a start or cancel reply gives, whatever else the command returns (FR-198).
export const jobIdOnly: ReplyPicker = (data) => ({ jobId: (data as JobStarted).jobId })

const FOLLOW = 'Gives the job ID at once; follow the run with get_job.'

export const RUN_TOOLS: readonly ToolDef[] = [
  {
    name: 'generate_images',
    description:
      'Start a run that makes pictures for one variant of an open project. Name a slot ' +
      '(from get_slots) or a layer_id, not both. count is 1 to 8. reference_asset_ids are ' +
      `asset IDs from list_assets, or an empty list. ${PROVIDER_WORDS} ${FOLLOW} ${LEAVE_THE_CHOICE}`,
    kind: 'command',
    target: 'generation.runImages',
    input: generationRunImagesAgentInput,
    reply: jobIdOnly,
    oneAtATime: true,
  },
  {
    name: 'generate_video',
    description:
      'Start a run that makes a video clip for one variant of an open project. duration_ms ' +
      'is the clip length in milliseconds. Three starts: from the prompt alone (start ' +
      '"none", use_references false, reference_asset_ids empty); from a first-frame picture ' +
      '(start "first_frame", use_references false, one ID in reference_asset_ids); with ' +
      'reference pictures (start "none", use_references true, their IDs in ' +
      'reference_asset_ids). A picture is named by an asset ID from list_assets. ' +
      `${PROVIDER_WORDS} ${FOLLOW} ${LEAVE_THE_CHOICE}`,
    kind: 'command',
    target: 'generation.startVideo',
    input: generationStartVideoAgentInput,
    reply: jobIdOnly,
    oneAtATime: true,
  },
  {
    name: 'cancel_job',
    description:
      'Cancel a run (job) of an open project that an agent started. Runs the user started ' +
      'cannot be cancelled. Some providers cannot stop a run once it is sent; the refusal ' +
      'says so. Gives the job ID; follow the run with get_job.',
    kind: 'command',
    target: 'job.cancel',
    input: jobCancelInput,
    reply: jobIdOnly,
  },
]
