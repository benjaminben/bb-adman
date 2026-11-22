import type { Signoff, Variant } from '../../visitor/actions'
import { CardSignoff } from '../card-signoff/card-signoff'
import { Lightbox } from '../lightbox/lightbox'
import { SignoffTick } from '../signoff-tick/signoff-tick'
import { VariantPicture } from '../variant-picture/variant-picture'
import styles from './variant-card.module.css'

type Props = {
  slug: string
  variant: Variant
  // The variant's sign-offs of its current version, oldest first.
  signoffs: Signoff[]
  reviewer: string | null
  // Signed off by this reviewer (spec/phases/round-2-approvals.md "The cards": "mine").
  mine: boolean
}

// spec/phases/round-2-approvals.md "The cards (items 19 and 21)": the card's state, by its edge
// and ground and by words. The id is the anchor a sign-off's redirect returns to; the card's
// lightbox sits inside it and outside every form.
export function VariantCard({ slug, variant, signoffs, reviewer, mine }: Props) {
  const { variantKey, version, title } = variant
  const state = variant.expired ? 'expired' : mine ? 'signed' : 'needs'
  return (
    <article id={`v-${variantKey}`} aria-labelledby={`t-${variantKey}`} className={styles[state]}>
      <div className={styles.body}>
        <VariantPicture
          slug={slug}
          variantKey={variantKey}
          version={version}
          title={title}
          sizeLine={variant.sizeLine}
          expired={variant.expired}
        />
        <div className={styles.words}>
          <h2 id={`t-${variantKey}`} className={styles.title}>
            {title}
          </h2>
          <p className={styles.muted}>{variant.sizeLine}</p>
          {signoffs.length === 0 ? null : (
            <p className={styles.muted}>Signed off by {signoffs.length}</p>
          )}
        </div>
      </div>
      {state === 'needs' ? (
        <CardSignoff slug={slug} variantKey={variantKey} version={version} title={title} />
      ) : null}
      {state === 'signed' ? (
        <div className={styles.end}>
          <SignoffTick variantKey={variantKey} />
        </div>
      ) : null}
      <Lightbox slug={slug} variant={variant} signoffs={signoffs} reviewer={reviewer} />
    </article>
  )
}
