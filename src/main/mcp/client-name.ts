// The agent's client name (spec/phases/phase-10.md, A-242): the MCP clientInfo.name from the
// client's own initialize, so untrusted text. It is cleaned as the ask's names are, shown as
// text only and never used as HTML or a path. Nothing left after cleaning is null.
import { cleanName } from './clean-name'

export function cleanClientName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  const name = cleanName(raw)
  return name === '' ? null : name
}
