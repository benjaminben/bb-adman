import { pictureSize } from '../picture-size'
import styles from './variant-picture.module.css'

type Props = {
  slug: string
  variantKey: string
  version: number
  title: string
  sizeLine: string
  expired: boolean
}

// spec/phases/round-2-approvals.md "The cards": the picture is a button that opens the card's
// lightbox (HTML's command buttons; a spread, since React's types do not list them). The button
// carries the name, so the picture inside is decoration. The address is built only from the
// checked slug, the view's variant key and a whole number; width and height keep its shape.
export function VariantPicture({ slug, variantKey, version, title, sizeLine, expired }: Props) {
  if (expired) {
    return (
      <p className={styles.expired}>
        This picture has expired. Ask the person who sent the link to update the gallery.
      </p>
    )
  }
  const { width, height } = pictureSize(sizeLine)
  const opens = { commandfor: `view-${variantKey}`, command: 'show-modal' }
  // A plain <img>: no image optimisation.
  return (
    <button type="button" className={styles.open} aria-label={`View larger: ${title}`} {...opens}>
      <img
        className={styles.picture}
        src={`/l/${slug}/p/${variantKey}/${version}`}
        alt=""
        width={width}
        height={height}
        loading="lazy"
      />
    </button>
  )
}
