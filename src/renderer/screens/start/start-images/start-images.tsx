// The start screen's left half (design/audit/spec-start.md "Left half: the image"): one large
// picture that crossfades to the next. Decoration only, so it is hidden from screen readers.
// The pictures are built files on the app's own origin; an empty folder gives a flat panel.
import { useImageCycle } from './use-image-cycle'
import styles from './start-images.module.css'

const found = import.meta.glob<string>('./images/start-*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
})
export const START_IMAGES: readonly string[] = Object.keys(found)
  .sort()
  .map((key) => found[key] as string)

function decode(url: string): Promise<void> {
  const img = new Image()
  img.src = url
  return typeof img.decode === 'function' ? img.decode() : Promise.resolve()
}

export function StartImages(props: { urls?: readonly string[] }) {
  const urls = props.urls ?? START_IMAGES
  const view = useImageCycle(urls.length, { preload: (i) => decode(urls[i] as string) })

  return (
    <div className={styles.images} aria-hidden="true" data-testid="start-images">
      {view.below !== null && (
        <img
          key={view.below}
          className={styles.image}
          src={urls[view.below]}
          alt=""
          aria-hidden="true"
        />
      )}
      {view.top !== null && (
        <img
          key={view.top}
          className={view.fading ? `${styles.image} ${styles.fadeIn}` : styles.image}
          src={urls[view.top]}
          alt=""
          aria-hidden="true"
        />
      )}
    </div>
  )
}
