// The Connect Section (SPEC 5.1 step 2, 5.3, 6.8; 14 1.58 J-9, 1.59 L-20; SET-5, OI-DW-4): a
// folded Section holding the address, the access token, the Claude Code line and, while there is
// an entry, the Claude Desktop block (P10-9). The token and the line reach it only as props from
// mcp.getConnectInfo, held in the Agent access section's own state. The token is drawn masked
// until "Show" (Masked), and as text only, in no attribute. Each Copy hands its text to the
// renderer's clipboard on a click only, masked or not; that is the one other place it goes.
import { useState } from 'react'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { Section } from '@/renderer/ui/section'
import layout from '@/renderer/ui/layout.module.css'
import styles from './connect-panel.module.css'
import { CopyIcon } from './copy-icon'
import { DesktopBlock } from './desktop-block'
import { Masked } from './masked'
import { useCopy, type CopyState } from './use-copy'

type Props = { address: string; token: string; claudeCode: string; claudeDesktop: string | null }

const FAILED = 'Copy did not work. Select the line and copy it.'

function Failed(props: { state: CopyState }) {
  if (props.state !== 'failed') return null
  return (
    <div className={styles.wide}>
      <NoticeLine kind="warn">{FAILED}</NoticeLine>
    </div>
  )
}

export function ConnectPanel(props: Props) {
  // Shown for one token only: a new token starts masked again.
  const [shownFor, setShownFor] = useState<string | null>(null)
  const shown = shownFor === props.token
  const [address, copyAddress] = useCopy(props.address)
  const [token, copyToken] = useCopy(props.token)
  const [line, copyLine] = useCopy(props.claudeCode)
  const summary = props.claudeDesktop === null ? 'Claude Code' : 'Claude Code · Claude Desktop'

  return (
    <Section
      id="settings.connect"
      title="Connect to Claude"
      level={4}
      fold="closed"
      summary={summary}
    >
      <div className={styles.values}>
        <p className={layout.label}>Address</p>
        <p className={styles.value}>{props.address}</p>
        <span className={styles.actions}>
          <CopyIcon label="Copy address" state={address} onCopy={() => void copyAddress()} />
        </span>
        <Failed state={address} />
        <p className={layout.label}>Access token</p>
        <p className={styles.value}>
          <Masked text={props.token} token={props.token} shown={shown} />
        </p>
        <span className={styles.actions}>
          <button
            type="button"
            className={`${layout.quiet} ${layout.small}`}
            onClick={() => setShownFor(shown ? null : props.token)}
          >
            {shown ? 'Hide' : 'Show'}
          </button>
          <CopyIcon label="Copy token" state={token} onCopy={() => void copyToken()} />
        </span>
        <Failed state={token} />
      </div>
      <p className={layout.label}>Claude Code</p>
      <pre className={styles.codeLine}>
        <code>
          <Masked text={props.claudeCode} token={props.token} shown={shown} />
        </code>
      </pre>
      <div className={layout.row}>
        <button type="button" className={layout.secondary} onClick={() => void copyLine()}>
          {line === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
      {line === 'failed' && <NoticeLine kind="warn">{FAILED}</NoticeLine>}
      {props.claudeDesktop !== null && (
        <DesktopBlock entry={props.claudeDesktop} token={props.token} shown={shown} />
      )}
    </Section>
  )
}
