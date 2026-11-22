// spec/editor.md, "Banner": at most one line, the first that applies. A missing file comes
// before text that does not fit [FR-098]. P4-16 (spec/screens-ai.md, "Place text with AI"):
// the layout job's line comes first of all, "Placing text with AI…" with Stop, or its
// failure with Dismiss. R2E-2 (spec/phases/round-2-editor.md D2, "Banner"): after the text is
// placed, an info line says how many texts had their colours changed, with Dismiss. ED-5: the
// overflow line is a short warn line, "{n} texts do not fit", with the fix in an InfoTip; the
// missing-file line and the layout lines keep their words.
import type { LayoutBannerLine } from '@/renderer/editor/layout-run'
import { Icon } from '@/renderer/ui/icon'
import { InfoTip } from '@/renderer/ui/info-tip'
import layout from '@/renderer/ui/layout.module.css'
import styles from './editor-banner.module.css'

// A full-width notice of its kind (spec/app-style.md "Editor", "Banner").
const DANGER = `${layout.notice} ${layout.danger} ${styles.banner}`
const WORKING = `${layout.notice} ${layout.info} ${styles.banner}`
const WARN = `${layout.notice} ${layout.warn} ${styles.banner}`

export type EditorBannerProps = {
  missingFile: boolean
  overflowCount: number
  layout?: LayoutBannerLine | null
}

const MISSING_WORDS = 'A file this variant uses cannot be found. Relink it from the project page.'

export function bannerWords(props: EditorBannerProps): string | null {
  if (props.missingFile) return MISSING_WORDS
  if (props.overflowCount === 1) return '1 text does not fit'
  if (props.overflowCount > 1) return `${props.overflowCount} texts do not fit`
  return null
}

export function changedWords(count: number): string {
  return `Text colour changed for legibility (${count})`
}

function ChangedLine({ count, onDismiss }: { count: number; onDismiss: () => void }) {
  return (
    <div className={WORKING}>
      <Icon name="info" size="small" />
      <p role="status" className={styles.words}>
        {changedWords(count)}
      </p>
      <button type="button" onClick={onDismiss}>
        Dismiss
      </button>
    </div>
  )
}

function LayoutLine({ line }: { line: LayoutBannerLine }) {
  if (line.kind === 'changed') return <ChangedLine count={line.count} onDismiss={line.onDismiss} />
  const running = line.kind === 'running'
  return (
    <div className={running ? WORKING : DANGER}>
      {running ? (
        <span className={styles.spin}>
          <Icon name="spinner" size="small" />
        </span>
      ) : (
        <Icon name="alert" size="small" />
      )}
      <p role="status" className={styles.words}>
        {running ? 'Placing text with AI…' : line.words}
      </p>
      <button type="button" onClick={running ? line.onStop : line.onDismiss}>
        {running ? 'Stop' : 'Dismiss'}
      </button>
    </div>
  )
}

function OverflowLine({ words }: { words: string }) {
  return (
    <div className={WARN}>
      <Icon name="alert" size="small" />
      <p role="status" className={styles.short}>
        {words}
      </p>
      <InfoTip about="fixing it">
        Make the box larger, the text smaller, or shorten the text.
      </InfoTip>
    </div>
  )
}

export function EditorBanner(props: EditorBannerProps) {
  if (props.layout) return <LayoutLine line={props.layout} />
  const words = bannerWords(props)
  if (words === null) return null
  if (!props.missingFile) return <OverflowLine words={words} />
  return (
    <p role="status" className={DANGER}>
      <Icon name="alert" size="small" />
      {words}
    </p>
  )
}
