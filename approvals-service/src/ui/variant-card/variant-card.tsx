import type { Signoff, Variant } from '../group-signoffs'
import { SignoffForm } from '../signoff-form/signoff-form'
import { SignoffList } from '../signoff-list/signoff-list'
import { VariantPicture } from '../variant-picture/variant-picture'
import styles from './variant-card.module.css'

type Props = { slug: string; variant: Variant; current: Signoff[]; earlier: Signoff[] }

// The id is the anchor a sign-off's redirect returns to.
export function VariantCard({ slug, variant, current, earlier }: Props) {
  const { variantKey, version, title } = variant
  return (
    <article id={`v-${variantKey}`} className={styles.card}>
      <VariantPicture
        slug={slug}
        variantKey={variantKey}
        version={version}
        title={title}
        expired={variant.expired}
      />
      <div className={styles.words}>
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.size}>{variant.sizeLine}</p>
      </div>
      <SignoffList
        slug={slug}
        heading="Signed off by"
        signoffs={current}
        muted={false}
        emptyText="No sign-offs yet."
      />
      {earlier.length === 0 ? null : (
        <SignoffList slug={slug} heading="For an earlier version" signoffs={earlier} muted />
      )}
      <SignoffForm slug={slug} variantKey={variantKey} version={version} />
    </article>
  )
}
