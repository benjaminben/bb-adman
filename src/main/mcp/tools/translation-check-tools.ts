// set_translation, run_checks and get_check_results (spec/phases/phase-10.md, the Phase 6 tools,
// A-236). set_translation writes a translation's text, always proposed and from the agent; its
// strict input has no status or source, and approving stays the user's act (translation.approve
// is deny). The user can undo it. run_checks writes the check rows only: no paid call, no
// provider call, no undo entry. get_check_results reads them. Every reply goes through a picker.
import { translationSetInput } from '@/shared/schemas/commands/translation'
import { checkRunInput } from '@/shared/schemas/commands/check'
import { checkResultsInput } from '@/shared/schemas/queries/check'
import { checkResultsFields, checkRunFields } from './check-replies'
import { layerIdsOnly } from './layer-replies'
import type { ToolDef } from './table'

const TARGET = 'Name either campaign_id or variant_ids (up to 1000), not both.'

export const TRANSLATION_CHECK_TOOLS: readonly ToolDef[] = [
  {
    name: 'set_translation',
    description:
      'Write the text of one translated text layer (a variant not in the main language) of an ' +
      'open project. The text is saved as proposed, never approved: only the user approves. ' +
      'With apply_to_same_language, also the same layer in the other variants of the direction ' +
      'in that language, unless their copy is overridden. Gives the IDs of the layers written. ' +
      'The user can undo it.',
    kind: 'command',
    target: 'translation.set',
    input: translationSetInput,
    reply: layerIdsOnly,
  },
  {
    name: 'run_checks',
    description:
      'Run the brand, legal and readiness checks on variants of an open project and store the ' +
      `results. ${TARGET} Changes no layer and starts no run. Gives each variant's results: ` +
      'each check by name with pass, warn or skipped and its findings.',
    kind: 'command',
    target: 'check.run',
    input: checkRunInput,
    reply: checkRunFields,
  },
  {
    name: 'get_check_results',
    description:
      'Read the stored check results of variants of an open project. ' +
      `${TARGET} For each variant that has been checked: its results, when and by whom they ` +
      'were run, and stale when the variant changed since.',
    kind: 'query',
    target: 'check.results',
    input: checkResultsInput,
    reply: checkResultsFields,
  },
]
