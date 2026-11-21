// spec/editor.md, "Banner": at most one line, the first that applies. A missing file comes
// before text that does not fit [FR-098].
import styles from './editor-banner.module.css'

export type EditorBannerProps = { missingFile: boolean; overflowCount: number }

const FIX = 'Make the box larger, the text smaller, or shorten the text.'

export function bannerWords(props: EditorBannerProps): string | null {
  if (props.missingFile) {
    return 'A file this variant uses cannot be found. Relink it from the project page.'
  }
  if (props.overflowCount === 1) return `1 text layer does not fit its box. ${FIX}`
  if (props.overflowCount > 1) {
    return `${props.overflowCount} text layers do not fit their box. ${FIX}`
  }
  return null
}

export function EditorBanner(props: EditorBannerProps) {
  const words = bannerWords(props)
  if (words === null) return null
  return (
    <p role="status" className={styles.banner}>
      {words}
    </p>
  )
}
