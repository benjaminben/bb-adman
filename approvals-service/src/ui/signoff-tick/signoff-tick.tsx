import styles from './signoff-tick.module.css'

// The green tick: a drawn check on a round ground, hidden from screen readers, since the
// words beside it or the button around it carry the meaning.
export function TickMark() {
  return (
    <span className={styles.mark}>
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false" className={styles.check}>
        <path d="M6 12.5l4 4 8-9" fill="none" stroke="currentColor" strokeWidth="2.5" />
      </svg>
    </span>
  )
}

// spec/phases/round-2-approvals.md "The cards": a card this reviewer signed off. The tick opens
// the card's lightbox (HTML's command buttons; a spread, since React's types do not list them).
export function SignoffTick({ variantKey }: { variantKey: string }) {
  const opens = { commandfor: `view-${variantKey}`, command: 'show-modal' }
  return (
    <button
      type="button"
      className={styles.tick}
      aria-label="Signed off by you. Open to view or remove."
      {...opens}
    >
      <TickMark />
    </button>
  )
}
