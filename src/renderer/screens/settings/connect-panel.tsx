// The Connect panel (SPEC 5.1 step 2, 5.3, 6.8; 14 1.58 J-9): one block, for Claude Code.
// The token and the line reach it only as props from mcp.getConnectInfo, held in the
// Agent access section's own state. They are drawn as text and put in no attribute.
import styles from '../screens.module.css'

export function ConnectPanel(props: { address: string; token: string; claudeCode: string }) {
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
    </section>
  )
}
