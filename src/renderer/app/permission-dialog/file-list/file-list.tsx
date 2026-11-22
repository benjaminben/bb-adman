// The list of files an import ask names (spec/phases/round-2-platform.md, D7): one item per
// path, in the order given, each drawn in full as text (never markup) and wrapping at any
// character; the box scrolls past about 8 lines and can take focus, so the keyboard scrolls
// it. While loading, and on failure, one line says so.
import type { AskFiles } from './use-ask-files'
import { visiblePath } from './visible-path'
import styles from './file-list.module.css'

export function FileList(props: { files: AskFiles }) {
  const { files } = props
  if (files.status === 'loading') return <p className={styles.line}>Loading the list of files…</p>
  if (files.status === 'failed') {
    return (
      <p role="alert" className={styles.line}>
        The list of files could not be shown.
      </p>
    )
  }
  return (
    <ol className={styles.list} aria-label="Files" tabIndex={0}>
      {files.files.map((file, index) => (
        <li key={index} className={styles.item}>
          {visiblePath(file)}
        </li>
      ))}
    </ol>
  )
}
