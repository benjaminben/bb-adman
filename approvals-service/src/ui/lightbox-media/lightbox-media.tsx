import type { Variant } from '../../visitor/actions'
import { pictureSize } from '../picture-size'
import styles from './lightbox-media.module.css'

type Props = { slug: string; variant: Variant }

// spec/phases/round-2-approvals.md "The lightbox": the picture, large, or the expiry sentence
// in its place. The address is the card's: built only from the checked slug, the view's
// variant key and a whole number. It loads lazily, so only when the dialog is first opened.
export function LightboxMedia({ slug, variant }: Props) {
  if (variant.expired) {
    return (
      <p className={styles.expired}>
        This picture has expired. Ask the person who sent the link to update the gallery.
      </p>
    )
  }
  const { width, height } = pictureSize(variant.sizeLine)
  return (
    <img
      className={styles.picture}
      src={`/l/${slug}/p/${variant.variantKey}/${variant.version}`}
      alt={variant.title}
      width={width}
      height={height}
      loading="lazy"
    />
  )
}
