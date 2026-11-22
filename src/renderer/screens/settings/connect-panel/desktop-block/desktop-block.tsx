// The Connect Section's Claude Desktop block (P10-9, A-245; SET-5): the entry for Claude
// Desktop's configuration file that starts this app in bridge mode. It holds no token today; if
// it ever did, the token is masked there as in the rest of the Section. It is drawn as text and
// put in no attribute; "Copy" hands it to the clipboard on a click only. The app never writes it
// into another program's file. Where to put it is in the InfoTip.
import { useId } from 'react'
import { NoticeLine } from '@/renderer/screens/settings/notice-line'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import { Masked } from '@/renderer/screens/settings/connect-panel/masked'
import { useCopy } from '@/renderer/screens/settings/connect-panel/use-copy'
import styles from './desktop-block.module.css'

export function DesktopBlock(props: { entry: string; token: string; shown: boolean }) {
  const [state, copy] = useCopy(props.entry)
  const titleId = useId()

  return (
    <section aria-labelledby={titleId}>
      <div className={layout.row}>
        <p id={titleId} className={layout.label}>
          Claude Desktop
        </p>
        <InfoTip about="Claude Desktop">
          Add this to Claude Desktop&apos;s configuration file, then restart Claude Desktop.
        </InfoTip>
      </div>
      <pre className={styles.entry}>
        <code>
          <Masked text={props.entry} token={props.token} shown={props.shown} />
        </code>
      </pre>
      <div className={layout.row}>
        <button type="button" className={layout.secondary} onClick={() => void copy()}>
          {state === 'copied' ? 'Copied' : 'Copy'}
        </button>
      </div>
      {state === 'failed' && (
        <NoticeLine kind="warn">Copy did not work. Select the text and copy it.</NoticeLine>
      )}
    </section>
  )
}
