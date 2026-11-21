// The agent's client name (spec/phases/phase-10.md, A-242): the MCP clientInfo.name from the
// client's own initialize, so untrusted text. It is shown on a permission prompt as text only,
// never used as HTML or a path. Stub (P10-1): every name is null until P10-8 cleans it.
export function cleanClientName(_raw: unknown): string | null {
  return null
}
