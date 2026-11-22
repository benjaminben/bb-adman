// The id of the agent-runs paid line, which describes each paid provider's Switch, and a helper
// that joins the ids of the lines describing a control.
export const PAID_ID = 'agent-runs-paid'

// The ids of the lines that describe a control, or undefined when there is none.
export function describedBy(...ids: Array<string | false>): string | undefined {
  const shown = ids.filter((id): id is string => id !== false)
  return shown.length > 0 ? shown.join(' ') : undefined
}
