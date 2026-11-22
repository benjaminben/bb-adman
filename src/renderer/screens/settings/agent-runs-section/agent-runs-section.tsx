// Settings: agent runs (spec/agent-runs.md, "Settings block"; SET-5). A Section with "{n} on" in
// its header. While any offered provider is paid, the paid line once at the top, word for word;
// then one row per provider that agentRunsOffered offers, each with its Switch ("Paid" marked and
// described by the paid line when its `local` is false); then the limit. Shown whether or not
// the MCP server is on. Each command's refusal shows as a line under its control.
import { useState } from 'react'
import { EMPTY, useApp } from '@/renderer/app/app-context'
import { agentRunsOffered } from '@/shared/config/agent-runs'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { Section } from '@/renderer/ui/section'
import { ProviderRow } from './provider-row'
import { RunLimit } from './run-limit'
import { PAID_ID } from './described-by'
import styles from './agent-runs-section.module.css'

const PAID = 'Paid. Each run an agent starts is charged to your account, with no click from you.'
const LIMIT_ID = 'agent-run-limit'

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
  const anyPaid = offered.some((p) => !p.local)
  const on = offered.filter((p) => agentRuns?.[p.id]?.allowed === true).length

  return (
    <Section id="settings.agentRuns" title="Agent runs" level={3} summary={`${on} on`}>
      {anyPaid && (
        <NoticeLine kind="warn" id={PAID_ID}>
          {PAID}
        </NoticeLine>
      )}
      <div className={styles.rows}>
        {offered.map((p) => {
          const allowed = agentRuns?.[p.id]?.allowed === true
          return (
            <ProviderRow
              key={p.id}
              provider={p}
              allowed={allowed}
              refusal={refusals[p.id] ?? null}
              onChange={() =>
                void send(p.id, 'agentRuns.setAllowed', { provider: p.id, allowed: !allowed })
              }
            />
          )
        })}
      </div>
      <RunLimit
        id={LIMIT_ID}
        value={typed ?? String(limit ?? '')}
        refusal={refusals[LIMIT_ID] ?? null}
        onChange={changeLimit}
      />
    </Section>
  )
}
