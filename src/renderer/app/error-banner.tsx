import { useApp } from './app-context'
import styles from './app-shell.module.css'

export function ErrorBanner() {
  const error = useApp((s) => s.error)
  const clear = useApp((s) => s.clearError)
  if (!error) return null
  return (
    <div role="alert" className={styles.alert}>
      <span>{error}</span>
      <button type="button" onClick={clear}>
        Dismiss
      </button>
    </div>
  )
}
