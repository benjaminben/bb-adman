import styles from './card-signoff.module.css'

type Props = { variantKey: string; version: number; title: string }

// spec/phases/round-2-approvals.md "The cards": a card that needs this reviewer's sign-off. The
// button sends the reviewer form, so the sign-off carries the email in the sidebar; its value
// is built only from the view's variant key and whole-number version.
export function CardSignoff({ variantKey, version, title }: Props) {
  return (
    <div className={styles.part}>
      <p className="hidden-text">Waiting for your sign-off.</p>
      <button
        type="submit"
        form="reviewer"
        name="one"
        value={`${variantKey}.${version}`}
        aria-label={`Sign off: ${title}`}
        className={styles.button}
      >
        Sign off
      </button>
    </div>
  )
}
