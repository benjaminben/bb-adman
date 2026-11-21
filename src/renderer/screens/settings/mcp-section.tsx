// Settings: agent access, the MCP server (SPEC 5.1, 5.3, 6.8; 14 1.56 MCP-C, 1.58 J-8, J-11).
// The reply of mcp.getConnectInfo, token included, is kept in this section's own state only
// (SPEC 5.3): never in a store, a log line or an attribute. After every command, success or
// refusal, the section reads it again: a refused new token may still have been saved
// (REVIEW MCP-A point 7.2).
import { useEffect, useState, type FormEvent } from 'react'
import { useApi, useApp } from '../../app/app-context'
import type { AdmanApi } from '../../../shared/schemas/api'
import type { ConnectInfo } from '../../../shared/schemas/queries/mcp'
import { ConnectPanel } from './connect-panel'
import styles from '../screens.module.css'

async function connectInfo(api: AdmanApi): Promise<ConnectInfo | null> {
  const result = await api.query('mcp.getConnectInfo', {})
  return result.ok && result.data ? (result.data as ConnectInfo) : null
}

// The state lines of SPEC 6.8 and 14 1.58 J-8, J-11.
function problemLine(info: ConnectInfo): string | null {
  if (info.problem === 'port_in_use') return `Port ${info.port} is in use. Choose another.`
  if (info.problem === 'token_missing') return 'There is no access token. Make a new token.'
  return null
}

export function McpSection() {
  const api = useApi()
  const command = useApp((s) => s.command)
  const [info, setInfo] = useState<ConnectInfo | null>(null)
  const [typed, setTyped] = useState<string | null>(null)
  const [refusal, setRefusal] = useState<string | null>(null)
  const [portRefusal, setPortRefusal] = useState<string | null>(null)
  // SPEC 14 1.48 TL-2: true from the send until the panel is read again.
  const [sending, setSending] = useState(false)

  useEffect(() => {
    let live = true
    void connectInfo(api).then((next) => {
      if (live) setInfo(next)
    })
    return () => {
      live = false
    }
  }, [api])

  async function send(name: string, input: unknown): Promise<string | null> {
    setSending(true)
    try {
      const result = await command(name, input)
      setInfo(await connectInfo(api))
      return result.ok ? null : result.error.message
    } finally {
      setSending(false)
    }
  }

  async function run(name: string, input: unknown) {
    setRefusal(await send(name, input))
  }

  async function savePort(event: FormEvent) {
    event.preventDefault()
    if (info === null) return
    const refused = await send('settings.update', { mcp: { port: Number(typed ?? info.port) } })
    setPortRefusal(refused)
    if (refused === null) setTyped(null)
  }

  if (info === null) {
    return (
      <section className={styles.card} aria-labelledby="mcp-title">
        <h2 id="mcp-title">Agent access</h2>
      </section>
    )
  }

  const state = problemLine(info)
  // A refused switch can repeat the state line word for word; it is drawn once.
  const lines = [state, refusal].filter(
    (x, i, all): x is string => x !== null && all.indexOf(x) === i,
  )

  return (
    <section className={styles.card} aria-labelledby="mcp-title">
      <h2 id="mcp-title">Agent access</h2>
      <label className={styles.row}>
        <input
          type="checkbox"
          role="switch"
          checked={info.enabled}
          disabled={sending}
          onChange={() => void run('mcp.setEnabled', { enabled: !info.enabled })}
        />
        Turn on agent access
      </label>
      <form className={styles.field} onSubmit={(e) => void savePort(e)}>
        <label htmlFor="mcp-port">Port</label>
        <div className={styles.row}>
          {/* No min or max: settings.update owns the range, so its sentence is the one shown. */}
          <input
            id="mcp-port"
            type="number"
            value={typed ?? String(info.port)}
            onChange={(e) => setTyped(e.target.value)}
            aria-describedby={portRefusal === null ? undefined : 'mcp-port-refusal'}
          />
          <button type="submit" disabled={sending}>
            Save port
          </button>
        </div>
        {portRefusal !== null && <p id="mcp-port-refusal">{portRefusal}</p>}
      </form>
      {lines.map((text) => (
        <p key={text}>{text}</p>
      ))}
      <div className={styles.row}>
        <button
          type="button"
          disabled={sending}
          onClick={() => void run('mcp.regenerateToken', {})}
        >
          Make a new token
        </button>
      </div>
      {info.enabled && info.token !== null && info.claudeCode !== null && (
        <ConnectPanel address={info.address} token={info.token} claudeCode={info.claudeCode} />
      )}
    </section>
  )
}
