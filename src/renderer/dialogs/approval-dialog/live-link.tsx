// The live link (spec/approvals.md "The approval link dialog"; DLG-6b). The link row: the
// address in its read-only field, the icon buttons "Copy link" and "Copy password", and a menu
// with "New password…". The gallery row: when it was updated, how many variants changed since,
// the still-only lines and "Update gallery". Then every variant's sign-offs. "Turn off…" is in
// the dialog's foot. Copy uses navigator.clipboard.writeText on the click; the password is
// never drawn.
import { useId, useState } from 'react'
import type { ApprovalsForCampaign } from '@/shared/schemas/queries/approvals'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { MoreMenu } from '@/renderer/ui/more-menu'
import { timeText } from '@/renderer/ui/signoff-list'
import { NOT_KEPT, NewPassword, useCopyPassword } from './password-section'
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

function IconAction(props: { label: string; icon: 'copy' | 'key'; onClick: () => void }) {
  return (
    <button
      type="button"
      className={layout.iconButton}
      aria-label={props.label}
      title={props.label}
      onClick={props.onClick}
    >
      <Icon name={props.icon} />
    </button>
  )
}

export function LiveLink(props: Props) {
  const { sender } = props
  const id = useId()
  const busy = sender.running !== null
  const [status, setStatus] = useState<string | null>(null)
  const [newPassword, setNewPassword] = useState(false)

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      setStatus('Copied.')
    } catch {
      setStatus(NO_CLIPBOARD)
    }
  }

  const password = useCopyPassword({ ...props, copy, onStatus: setStatus })
  const link = props.data.link
  if (link === null) return null
  const address = link.address
  const kept = link.passwordKept && !password.notKept
  const changed = props.data.variants.filter((v) => v.publishedRev !== v.currentRev).length
  const menu = [
    {
      id: 'password',
      label: 'New password…',
      disabled: busy,
      reason: 'Working…',
      onChoose: () => setNewPassword(true),
    },
  ]

  return (
    <>
      <section className={styles.section} aria-labelledby={`${id}-link`}>
        <h3 id={`${id}-link`} className={styles.heading}>
          Link
        </h3>
        <div className={styles.linkRow}>
          <input
            className={styles.address}
            aria-labelledby={`${id}-link`}
            readOnly
            value={address ?? ''}
          />
          {address !== null && (
            <IconAction label="Copy link" icon="copy" onClick={() => void copy(address)} />
          )}
          {kept && (
            <IconAction
              label="Copy password"
              icon="key"
              onClick={() => void password.copyPassword()}
            />
          )}
          <MoreMenu label="the link" items={menu} />
        </div>
        {!kept && <p className={styles.line}>{NOT_KEPT}</p>}
        {newPassword && <NewPassword sender={sender} onClose={() => setNewPassword(false)} />}
      </section>
      <p role="status" className={styles.line}>
        {status}
      </p>
      <section className={styles.section} aria-labelledby={`${id}-gallery`}>
        <div className={styles.galleryRow}>
          <h3 id={`${id}-gallery`} className={styles.heading}>
            Gallery
          </h3>
          <span className={styles.meta}>
            {link.publishedAt !== null && <span>Updated {timeText(link.publishedAt)}.</span>}
            {changed > 0 && <span>{changedText(changed)}</span>}
          </span>
          <button
            type="button"
            className={layout.secondary}
            disabled={busy}
            onClick={() => void sender.send('approvals.publish')}
          >
            Update gallery
          </button>
        </div>
        <StillOnlyNotes variants={props.data.variants} titles={props.titles} />
      </section>
      <SignoffsByVariant variants={props.data.variants} titles={props.titles} />
      <p className={styles.line}>If you delete this campaign, turn its link off first.</p>
    </>
  )
}
