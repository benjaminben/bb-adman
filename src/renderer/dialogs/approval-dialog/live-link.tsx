// The live link (spec/approvals.md "The approval link dialog"): the address and "Copy link",
// the password part, the gallery with its still-only lines and "Update gallery", every
// variant's sign-offs, and "Turn off link…" with its confirmation. Copy uses
// navigator.clipboard.writeText on the click.
import { useId, useState } from 'react'
import type { ApprovalsForCampaign } from '@/shared/schemas/queries/approvals'
import { timeText } from '@/renderer/ui/signoff-list'
import layout from '@/renderer/ui/layout.module.css'
import { EndLinkConfirm } from './end-link-confirm'
import { PasswordSection } from './password-section'
import { SignoffsByVariant } from './signoffs-by-variant'
import { StillOnlyNotes } from './still-only-notes'
import type { Sender } from './use-send'
import styles from './approval-dialog.module.css'

type Props = {
  projectId: string
  campaignId: string
  data: ApprovalsForCampaign
  titles: Record<string, string>
  sender: Sender
}

const NO_CLIPBOARD = 'The clipboard could not be used.'

function changedText(n: number): string {
  return n === 1 ? '1 variant changed since.' : `${n} variants changed since.`
}

export function LiveLink(props: Props) {
  const { sender } = props
  const id = useId()
  const busy = sender.running !== null
  const [status, setStatus] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const link = props.data.link
  if (link === null) return null
  const address = link.address
  const changed = props.data.variants.filter((v) => v.publishedRev !== v.currentRev).length

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('Copied.')
    } catch {
      setStatus(NO_CLIPBOARD)
    }
  }

  if (confirming) {
    return (
      <EndLinkConfirm
        busy={busy}
        onKeep={() => setConfirming(false)}
        onTurnOff={() => void sender.send('approvals.endLink')}
      />
    )
  }

  return (
    <>
      <section className={styles.section} aria-labelledby={`${id}-link`}>
        <h3 id={`${id}-link`} className={styles.heading}>
          Link
        </h3>
        <div className={layout.row}>
          <input
            className={styles.address}
            aria-labelledby={`${id}-link`}
            readOnly
            value={address ?? ''}
          />
          <button
            type="button"
            disabled={address === null}
            onClick={() => address !== null && void copy(address)}
          >
            Copy link
          </button>
        </div>
      </section>
      <PasswordSection
        projectId={props.projectId}
        campaignId={props.campaignId}
        kept={link.passwordKept}
        sender={sender}
        headingId={`${id}-password`}
        copy={copy}
        onStatus={setStatus}
      />
      <p role="status" className={styles.line}>
        {status}
      </p>
      <section className={styles.section} aria-labelledby={`${id}-gallery`}>
        <h3 id={`${id}-gallery`} className={styles.heading}>
          Gallery
        </h3>
        {link.publishedAt !== null && (
          <p className={styles.line}>Updated {timeText(link.publishedAt)}.</p>
        )}
        {changed > 0 && <p className={styles.line}>{changedText(changed)}</p>}
        <StillOnlyNotes variants={props.data.variants} titles={props.titles} />
        <div className={layout.row}>
          <button
            type="button"
            disabled={busy}
            onClick={() => void sender.send('approvals.publish')}
          >
            Update gallery
          </button>
        </div>
      </section>
      <SignoffsByVariant variants={props.data.variants} titles={props.titles} />
      <div className={layout.row}>
        <button type="button" disabled={busy} onClick={() => setConfirming(true)}>
          Turn off link…
        </button>
      </div>
      <p className={styles.line}>If you delete this campaign, turn its link off first.</p>
    </>
  )
}
