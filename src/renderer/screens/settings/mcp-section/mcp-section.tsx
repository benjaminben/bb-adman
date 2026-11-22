// Settings: agent access, the MCP server (SPEC 5.1, 5.3, 6.8; 14 1.56 MCP-C, 1.58 J-8, J-11,
// 1.59 L-21). A Section with the switch in its header (SET-5); the port (saved on Enter or when
// left, SET-6), the problem lines word for word, "New token", the auto-delete row and, while on
// with a token, Connect.
// The reply of mcp.getConnectInfo, token included, is kept in this section's own state only
// (SPEC 5.3): never in a store, a log line or an attribute. After every command, success or
// refusal, the section reads it again: a refused new token may still have been saved
// (REVIEW MCP-A point 7.2).
import { useEffect, useState } from 'react'
import { useApi, useApp } from '@/renderer/app/app-context'
import type { AdmanApi } from '@/shared/schemas/api'
import type { ConnectInfo } from '@/shared/schemas/queries/mcp'
import { ConnectPanel } from '@/renderer/screens/settings/connect-panel'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { AutoApproveSetting } from '@/renderer/screens/settings/auto-approve-setting'
import { Section } from '@/renderer/ui/section'
import layout from '@/renderer/ui/layout.module.css'
import { PortField } from './port-field'
import styles from './mcp-section.module.css'

// A refused query gives its own fixed message (SPEC 4.3; 14 1.59 L-21), never reply data.
type Read = { info: ConnectInfo } | { refused: string }

async function connectInfo(api: AdmanApi): Promise<Read | null> {
  const result = await api.query('mcp.getConnectInfo', {})
  if (!result.ok) return { refused: result.error.message }
  return result.data ? { info: result.data as ConnectInfo } : null
}

// The state lines of SPEC 6.8 and 14 1.58 J-8, J-11, 1.59 L-10.
function problemLine(info: ConnectInfo): string | null {
  if (info.problem === 'port_in_use') return `Port ${info.port} is in use. Choose another.`
  if (info.problem === 'token_missing') return 'There is no access token. Make a new token.'
  if (info.problem === 'start_failed') {
    return 'The MCP server could not start. Turn it off and on to try again.'
  }
  return null
}

export function McpSection() {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [read, setRead] = useState<Read | null>(null)
  const info = read !== null && 'info' in read ? read.info : null
  const [refusal, setRefusal] = useState<string | null>(null)
  const [portRefusal, setPortRefusal] = useState<string | null>(null)
  // SPEC 14 1.48 TL-2: true from the send until the panel is read again.
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let live = true
    void connectInfo(api).then((next) => {
      if (live) setRead(next)
    })
    return () => {
      live = false
    }
  }, [api])

  async function send(name: string, input: unknown): Promise<string | null> {
    setSending(true)
    try {
      const result = await command(name, input)
      setRead(await connectInfo(api))
      if (!result.ok) return result.error.message
      // REVIEW MCP-C 6e: any success clears both lines, so no old refusal outlives its fix.
      setRefusal(null)
      setPortRefusal(null)
      return null
    } finally {
      setSending(false)
    }
  }

  async function run(name: string, input: unknown) {
    setRefusal(await send(name, input))
  }

  async function savePort(port: number): Promise<boolean> {
    const refused = await send('settings.update', { mcp: { port } })
    setPortRefusal(refused)
    return refused === null
  }

  if (info === null) {
    return (
      <Section id="settings.agentAccess" title="Agent access" level={3} fold="none">
        {read !== null && 'refused' in read && (
          <NoticeLine kind="danger">{read.refused}</NoticeLine>
        )}
      </Section>
    )
  }

  const state = problemLine(info)
  // A refused switch can repeat the state line word for word; it is drawn once.
  const lines = [state, refusal].filter(
    (x, i, all): x is string => x !== null && all.indexOf(x) === i,
  )
  const summary = (
    <span className={styles.access}>
      <input
        type="checkbox"
        role="switch"
        aria-label="Turn on agent access"
        className={layout.switch}
        checked={info.enabled}
        disabled={sending}
        onChange={() => void run('mcp.setEnabled', { enabled: !info.enabled })}
      />
      <span aria-hidden="true">{info.enabled ? 'On' : 'Off'}</span>
    </span>
  )

  return (
    <Section id="settings.agentAccess" title="Agent access" level={3} fold="none" summary={summary}>
      <PortField saved={info.port} refusal={portRefusal} sending={sending} onSave={savePort} />
      {lines.map((text) => (
        <NoticeLine key={text} kind={text === state ? 'warn' : 'danger'}>
          {text}
        </NoticeLine>
      ))}
      <div className={styles.actions}>
        <button
          type="button"
          className={`${layout.quiet} ${layout.small}`}
          aria-label="Make a new token"
          disabled={sending}
          onClick={() => void run('mcp.regenerateToken', {})}
        >
          New token
        </button>
      </div>
      <AutoApproveSetting />
      {info.enabled && info.token !== null && info.claudeCode !== null && (
        <ConnectPanel
          address={info.address}
          token={info.token}
          claudeCode={info.claudeCode}
          claudeDesktop={info.claudeDesktop}
        />
      )}
    </Section>
  )
}
