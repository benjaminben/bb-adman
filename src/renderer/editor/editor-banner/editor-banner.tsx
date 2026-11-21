// spec/editor.md, "Banner": at most one line, the first that applies. A missing file comes
// before text that does not fit [FR-098]. P4-16 (spec/screens-ai.md, "Place text with AI"):
// the layout job's line comes first of all, "Placing text with AI…" with Stop, or its
// failure with Dismiss.
import type { LayoutBannerLine } from '@/renderer/editor/layout-run'
import styles from './editor-banner.module.css'

export type EditorBannerProps = {
  missingFile: boolean
  overflowCount: number
  layout?: LayoutBannerLine | null
}

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

function LayoutLine({ line }: { line: LayoutBannerLine }) {
  const running = line.kind === 'running'
  return (
    <div className={running ? styles.working : styles.banner}>
      <p role="status" className={styles.words}>
        {running ? 'Placing text with AI…' : line.words}
      </p>
      <button type="button" onClick={running ? line.onStop : line.onDismiss}>
        {running ? 'Stop' : 'Dismiss'}
      </button>
    </div>
  )
}

export function EditorBanner(props: EditorBannerProps) {
  if (props.layout) return <LayoutLine line={props.layout} />
  const words = bannerWords(props)
  if (words === null) return null
  return (
    <p role="status" className={styles.banner}>
      {words}
    </p>
  )
}
