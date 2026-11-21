// The Connect panel (SPEC 5.1 step 2, 5.3, 6.8; 14 1.58 J-9, 1.59 L-20): one block, for
// Claude Code. The token and the line reach it only as props from mcp.getConnectInfo, held
// in the Agent access section's own state. They are drawn as text and put in no attribute.
// "Copy" hands the line to the renderer's clipboard on click only; that is the one other
// place it goes. A failed copy logs nothing.
import { useState } from 'react'
import styles from '../screens.module.css'

// The line a copy was tried for, so a new token's line starts again at "Copy".
type CopyResult = { line: string; ok: boolean }

export function ConnectPanel(props: { address: string; token: string; claudeCode: string }) {
  const [copy, setCopy] = useState<CopyResult | null>(null)
  const result = copy !== null && copy.line === props.claudeCode ? copy : null

  async function copyLine() {
    const text = props.claudeCode
    try {
      await navigator.clipboard.writeText(text)
      setCopy({ line: text, ok: true })
    } catch {
      setCopy({ line: text, ok: false })
    }
  }

  return (
    <section aria-labelledby="mcp-connect-title">
      <h3 id="mcp-connect-title">Connect to Claude</h3>
      <p className={styles.label}>Address</p>
      <p className={styles.path}>{props.address}</p>
      <p className={styles.label}>Access token</p>
      <p className={styles.path}>{props.token}</p>
      <p className={styles.label}>Claude Code</p>
      <pre className={styles.codeLine}>
        <code>{props.claudeCode}</code>
      </pre>
      <div className={styles.row}>
        <button type="button" onClick={() => void copyLine()}>
          {result?.ok ? 'Copied' : 'Copy'}
        </button>
      </div>
      {result?.ok === false && <p>Copy did not work. Select the line and copy it.</p>}
    </section>
  )
}
