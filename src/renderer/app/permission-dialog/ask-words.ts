// The words of the permission dialog per kind of ask (spec/phases/round-2-platform.md, D7;
// P10-7; spec/comfyui-custom.md, "The agent's ask"). They are chosen from the kind and the
// action, which the main process takes from its fixed policy table, so no text an agent
// writes can choose or change them. `cost` is the fixed last line of the body: what allowing
// leads to.
import type { EventMap } from '@/shared/schemas/events'

type Ask = EventMap['agent.permissionRequested']

export type AskWords = { title: string; allow: string; cost: string }

const BRIEF_ACTION = 'make campaigns that import files'
const UNDONE = 'This cannot be undone.'
const IMPORT_COST =
  'Once imported, agents can place these files in ads and send pictures to AI providers you allowed.'
const WORKFLOW_COST =
  'This workflow will run on your ComfyUI server and can use any node installed there, ' +
  'including nodes that read files on that computer, reach the internet or use paid services.'
const DELETE_COST: Record<string, string> = {
  'delete variants': 'This cannot be undone. It also clears the undo list of this campaign.',
  'delete campaigns': UNDONE,
  'delete subjects': 'This cannot be undone. Its photos stay in the project without a subject.',
  'remove ComfyUI workflows': 'This cannot be undone. Runs that have not started yet will fail.',
}

export function askWords(ask: Ask): AskWords {
  if (ask.kind === 'delete') {
    return {
      title: 'An agent asks to delete',
      allow: 'Allow',
      cost: DELETE_COST[ask.action] ?? UNDONE,
    }
  }
  if (ask.kind === 'workflow') {
    return { title: 'An agent asks to add a ComfyUI workflow', allow: 'Add', cost: WORKFLOW_COST }
  }
  if (ask.action === BRIEF_ACTION) {
    return {
      title: 'An agent asks to make a campaign with files',
      allow: 'Allow',
      cost: IMPORT_COST,
    }
  }
  return { title: 'An agent asks to import files', allow: 'Import', cost: IMPORT_COST }
}
