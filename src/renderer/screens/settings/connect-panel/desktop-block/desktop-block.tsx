// The Connect panel's Claude Desktop block (P10-9, A-245): the entry for Claude Desktop's
// configuration file that starts this app in bridge mode. It holds no token. It is drawn as
// text and put in no attribute; "Copy" hands it to the clipboard on click only. The app never
// writes it into another program's file.
import { useState } from 'react'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import layout from '@/renderer/ui/layout.module.css'
import styles from './desktop-block.module.css'

// The entry a copy was tried for, so a new entry starts again at "Copy".
type CopyResult = { text: string; ok: boolean }

export function DesktopBlock(props: { entry: string }) {
  const [copy, setCopy] = useState<CopyResult | null>(null)
  const result = copy !== null && copy.text === props.entry ? copy : null

  async function copyEntry() {
    const text = props.entry
    try {
      await navigator.clipboard.writeText(text)
      setCopy({ text, ok: true })
    } catch {
      setCopy({ text, ok: false })
    }
  }

  return (
    <section aria-labelledby="mcp-desktop-title">
      <p id="mcp-desktop-title" className={layout.label}>
        Claude Desktop
      </p>
      <p>Add this to Claude Desktop's configuration file, then restart Claude Desktop.</p>
      <pre className={styles.entry}>
        <code>{props.entry}</code>
      </pre>
      <div className={layout.row}>
        <button type="button" onClick={() => void copyEntry()}>
          {result?.ok ? 'Copied' : 'Copy'}
        </button>
      </div>
      {result?.ok === false && (
        <NoticeLine kind="warn">Copy did not work. Select the text and copy it.</NoticeLine>
      )}
    </section>
  )
}
