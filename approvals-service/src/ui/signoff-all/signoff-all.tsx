import styles from './signoff-all.module.css'

// `left`: live variants this reviewer has not signed. `live`: live variants in the gallery.
// `videos`: live video variants with a clip.
type Props = { slug: string; reviewer: string | null; left: number; live: number; videos: number }

// HTML's command buttons; React passes these lowercase names through as written. A spread,
// since React's types do not list them yet.
const command = (action: 'show-modal' | 'close') => ({ commandfor: 'confirm-all', command: action })

const lineFor = ({ reviewer, left, live }: Props) => {
  if (live === 0) return 'Nothing to sign off yet.'
  if (reviewer === null) return 'Signs every variant shown, as the email above.'
  return left > 0 ? `${left} left to sign off.` : 'You have signed off on every variant.'
}

// round-2-approvals-video.md "Sign off all": a reviewer is asked to watch the videos first.
const videosLine = (videos: number) =>
  videos === 0
    ? ''
    : ` It includes ${videos} ${videos === 1 ? 'video' : 'videos'}. Watch each one before you sign off.`

// spec/phases/round-2-approvals.md "Sign off all": one click writes many rows, so it asks
// first. The confirmation's submit sends the reviewer form with `all=1` and the page's stamp.
export function SignoffAll(props: Props) {
  const disabled = props.live === 0 || (props.reviewer !== null && props.left === 0)
  return (
    <div className={styles.part}>
      <button
        type="button"
        className={styles.primary}
        disabled={disabled}
        aria-describedby="signoff-all-line"
        {...command('show-modal')}
      >
        Sign off all…
      </button>
      <p id="signoff-all-line" className={styles.line}>
        {lineFor(props)}
      </p>
      <dialog id="confirm-all" aria-labelledby="confirm-all-title" className={styles.dialog}>
        <h2 id="confirm-all-title" className={styles.title}>
          Sign off all?
        </h2>
        <p className={styles.text}>
          This signs off on every variant shown that you have not signed yet, as the email under
          “Signing off as:”. You can remove a sign-off later, one at a time.
          {videosLine(props.videos)}
        </p>
        <div className={styles.actions}>
          <button type="button" className={styles.quiet} autoFocus {...command('close')}>
            Cancel
          </button>
          <button
            type="submit"
            form="reviewer"
            formAction={`/l/${props.slug}/signoffs`}
            name="all"
            value="1"
            formNoValidate
            className={styles.primary}
          >
            Sign off all
          </button>
        </div>
      </dialog>
    </div>
  )
}
