// The words of the permission dialog per kind of ask (spec/phases/round-2-platform.md, D7;
// P10-7). They are chosen from the kind and the action, which the main process takes from its
// fixed policy table, so no text an agent writes can choose or change them.
import type { EventMap } from '@/shared/schemas/events'

type Ask = EventMap['agent.permissionRequested']

export type AskWords = { title: string; allow: string }

const BRIEF_ACTION = 'make campaigns that import files'

export function askWords(ask: Ask): AskWords {
  if (ask.kind === 'delete') return { title: 'An agent asks to delete', allow: 'Allow' }
  if (ask.action === BRIEF_ACTION) {
    return { title: 'An agent asks to make a campaign with files', allow: 'Allow' }
  }
  return { title: 'An agent asks to import files', allow: 'Import' }
}
