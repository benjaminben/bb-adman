// The failed command message under the top bar: a danger notice with the alert icon across the
// full width (spec/app-style.md, "App shell and tabs").
import { useApp } from '@/renderer/app/app-context'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import styles from './error-banner.module.css'

export function ErrorBanner() {
  const error = useApp((s) => s.error)
  const clear = useApp((s) => s.clearError)
  if (!error) return null
  return (
    <div role="alert" className={`${layout.notice} ${layout.danger} ${styles.alert}`}>
      <Icon name="alert" />
      <span>{error}</span>
      <button type="button" onClick={clear}>
        Dismiss
      </button>
    </div>
  )
}
