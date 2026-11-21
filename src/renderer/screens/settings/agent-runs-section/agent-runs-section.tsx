// Settings: agent runs (spec/agent-runs.md, "Settings block"). One tick per provider that
// agentRunsOffered offers, a paid line under one whose `local` is false, and the limit. Shown
// whether or not the MCP server is on. Each command's refusal shows as a line under its control,
// as the agent access section does.
import { useState } from 'react'
import { EMPTY, useApp } from '@/renderer/app/app-context'
import {
  AGENT_RUN_LIMIT_MAX,
  AGENT_RUN_LIMIT_MIN,
  agentRunsOffered,
} from '@/shared/config/agent-runs'
import layout from '@/renderer/ui/layout.module.css'

const PAID = 'Paid. Each run an agent starts is charged to your account, with no click from you.'
const LIMIT_ID = 'agent-run-limit'

// The ids of the lines that describe a control, or undefined when there is none.
function describedBy(...ids: Array<string | false>): string | undefined {
  const shown = ids.filter((id): id is string => id !== false)
  return shown.length > 0 ? shown.join(' ') : undefined
}

export function AgentRunsSection() {
  const providers = useApp((s) => s.app?.providers ?? EMPTY)
  const agentRuns = useApp((s) => s.app?.settings.agentRuns)
  const limit = useApp((s) => s.app?.settings.agentRunLimit)
  const command = useApp((s) => s.command)
  // Refusal lines by provider ID, and LIMIT_ID for the limit.
  const [refusals, setRefusals] = useState<Record<string, string | null>>({})
  const [typed, setTyped] = useState<string | null>(null)

  async function send(key: string, name: string, input: unknown) {
    const result = await command(name, input)
    setRefusals((all) => ({ ...all, [key]: result.ok ? null : result.error.message }))
  }

  function changeLimit(text: string) {
    setTyped(text)
    if (text.trim() !== '') void send(LIMIT_ID, 'agentRuns.setLimit', { limit: Number(text) })
  }

  const offered = providers.filter((p) => agentRunsOffered(p) === null)
  const limitRefusal = refusals[LIMIT_ID] ?? null

  return (
    <section className={layout.card} aria-labelledby="agent-runs-title">
      <h2 id="agent-runs-title">Agent runs</h2>
      {offered.map((p) => {
        const allowed = agentRuns?.[p.id]?.allowed === true
        const refusal = refusals[p.id] ?? null
        const paidId = `agent-runs-paid-${p.id}`
        const refusalId = `agent-runs-refusal-${p.id}`
        return (
          <div key={p.id} className={layout.field}>
            <label className={layout.row}>
              <input
                type="checkbox"
                checked={allowed}
                aria-describedby={describedBy(!p.local && paidId, refusal !== null && refusalId)}
                onChange={() =>
                  void send(p.id, 'agentRuns.setAllowed', { provider: p.id, allowed: !allowed })
                }
              />
              Let agents start runs with {p.label}
            </label>
            {!p.local && (
              <p id={paidId} className={layout.muted}>
                {PAID}
              </p>
            )}
            {refusal !== null && <p id={refusalId}>{refusal}</p>}
          </div>
        )
      })}
      <div className={layout.field}>
        <label htmlFor={LIMIT_ID}>Most runs agents may have waiting or running, per provider</label>
        <input
          id={LIMIT_ID}
          type="number"
          min={AGENT_RUN_LIMIT_MIN}
          max={AGENT_RUN_LIMIT_MAX}
          step={1}
          value={typed ?? String(limit ?? '')}
          onChange={(e) => changeLimit(e.target.value)}
          aria-describedby={describedBy(limitRefusal !== null && `${LIMIT_ID}-refusal`)}
        />
        {limitRefusal !== null && <p id={`${LIMIT_ID}-refusal`}>{limitRefusal}</p>}
      </div>
    </section>
  )
}
