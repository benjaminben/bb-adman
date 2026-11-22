// The AI tools over the Phase 4 jobs (spec/phases/phase-10.md, A-231, A-232; security class
// full). Each runs one command whose agent policy is tick, so the agent-run gate in the bus
// decides: the provider must be ticked by the user and under the limit. Nothing here checks a
// tick, a provider or a limit. Each runs one at a time through the serial the start tools share
// (oneAtATime), and replies { jobId } only. cut_out does not offer licenceConfirmed: an agent
// cannot confirm a licence (S2-4). get_job shows what each run made (agentJobView).
import {
  generationCopyOptionsInput,
  generationCutOutAgentInput,
  generationProposeLayoutInput,
} from '@/shared/schemas/commands/generation'
import { jobIdOnly } from './run-tools'
import type { ToolDef } from './table'
import { LEAVE_THE_CHOICE } from './tool-words'

const FOLLOW = 'Gives the job ID at once; follow the run with get_job.'

// PROVIDER_WORDS names the picture providers; these runs have their own (spec/ai-jobs.md).
const ALLOWED =
  "Runs are refused unless the user allowed agents for that provider in Adman's Settings."
const GEMINI = `provider is "gemini" (paid, charged to the user's Google account with no click). ${ALLOWED}`
const COMFY = `provider is "comfyui" (the user's own ComfyUI server, no charge). ${ALLOWED}`

export const AI_TOOLS: readonly ToolDef[] = [
  {
    name: 'propose_layout',
    description:
      'Start a run that proposes where the text of one variant of an open project goes. The ' +
      'variant needs a visible text layer with text. When the run has succeeded, get_job ' +
      'gives layout.boxes: for each text layer, by its key in slot, x, y, width, height, ' +
      'fontSize, align and color. Nothing is changed by the run; apply the boxes with ' +
      `update_layers. ${GEMINI} ${FOLLOW} ${LEAVE_THE_CHOICE}`,
    kind: 'command',
    target: 'generation.proposeLayout',
    input: generationProposeLayoutInput,
    reply: jobIdOnly,
    oneAtATime: true,
  },
  {
    name: 'copy_options',
    description:
      'Start a run that writes count other texts for one text layer of a variant of an open ' +
      'project (not the headline, which is the campaign message). When the run has ' +
      'succeeded, get_job gives copyOptions, a list of texts. Nothing is changed by the run; ' +
      `put a text on the layer with update_layer. ${GEMINI} ${FOLLOW} ${LEAVE_THE_CHOICE}`,
    kind: 'command',
    target: 'generation.copyOptions',
    input: generationCopyOptionsInput,
    reply: jobIdOnly,
    oneAtATime: true,
  },
  {
    name: 'cut_out',
    description:
      'Start a run that cuts the picture of one picture layer of a variant of an open ' +
      'project out from its background. When the run has succeeded, get_job gives the new ' +
      `picture's asset ID in assetIds. ${COMFY} ${FOLLOW} ${LEAVE_THE_CHOICE}`,
    kind: 'command',
    target: 'generation.cutOut',
    input: generationCutOutAgentInput,
    reply: jobIdOnly,
    oneAtATime: true,
  },
]
