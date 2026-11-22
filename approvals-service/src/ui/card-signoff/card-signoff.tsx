import styles from './card-signoff.module.css'

type Props = { slug: string; variantKey: string; version: number; title: string }

// spec/phases/round-2-approvals.md "The cards": a card that needs this reviewer's sign-off. The
// button sends the reviewer form to the sign-off route, so the sign-off carries the email in the
// sidebar; its address and value are built only from the checked slug, the view's variant key
// and whole-number version.
export function CardSignoff({ slug, variantKey, version, title }: Props) {
  return (
    <div className={styles.part}>
      <p className="hidden-text">Waiting for your sign-off.</p>
      <button
        type="submit"
        form="reviewer"
        formAction={`/l/${slug}/signoffs`}
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
