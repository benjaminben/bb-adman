import styles from './variant-picture.module.css'

type Props = { slug: string; variantKey: string; version: number; title: string; expired: boolean }

// The address is built only from the checked slug, the view's variant key and a whole number.
export function VariantPicture({ slug, variantKey, version, title, expired }: Props) {
  if (expired) {
    return (
      <div className={styles.expired}>
        This picture has expired. Ask the person who sent the link to update the gallery.
      </div>
    )
  }
  // A plain <img>: no image optimisation.
  return (
    <img
      className={styles.picture}
      src={`/l/${slug}/p/${variantKey}/${version}`}
      alt={title}
      loading="lazy"
    />
  )
}
