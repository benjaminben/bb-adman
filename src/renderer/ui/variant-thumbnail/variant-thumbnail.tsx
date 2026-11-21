// A variant's thumbnail (spec/editor.md, "Thumbnails on the screens"): the PNG, fitted inside
// the box its parent gives it, or the words "No preview" when the draw failed. While a draw is
// pending it draws nothing, so the parent's box keeps its size.
import { useThumbnail } from './use-thumbnail'
import styles from './variant-thumbnail.module.css'

export type VariantThumbnailProps = {
  projectId: string
  variantId: string
  rev: number
  alt: string
}

export function VariantThumbnail(props: VariantThumbnailProps) {
  const view = useThumbnail(props.projectId, props.variantId, props.rev)
  if (view.kind === 'failed') return <span className={styles.none}>No preview</span>
  if (view.kind === 'picture')
    return <img className={styles.picture} src={view.url} alt={props.alt} />
  return null
}
