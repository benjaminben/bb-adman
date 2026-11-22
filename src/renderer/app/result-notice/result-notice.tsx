// The result notice (spec/phases/round-2-editor.md D6, "Result notice", R2E-6): one info line
// under the error banner when a run finishes out of view, worded by kind with the place as
// the activity row words it. "Show" goes there through ui/show-result.ts and closes the line;
// "Dismiss" closes it. It holds the kind and the place only, and sends no job.markSeen. The
// live region is always drawn, so a line that appears in it is read out.
import { useApi } from '@/renderer/app/app-context'
import { whereText } from '@/renderer/app/activity-row/row-text'
import { useNavStore } from '@/renderer/app/nav-context'
import { Icon } from '@/renderer/ui/icon'
import layout from '@/renderer/ui/layout.module.css'
import { showResult } from '@/renderer/ui/show-result'
import { NOTICE_WORDS, useResultNotice } from './use-result-notice'
import styles from './result-notice.module.css'

export function ResultNotice(props: { projectId: string }) {
  const { projectId } = props
  const api = useApi()
  const nav = useNavStore()
  const { entry, close } = useResultNotice(projectId)

  function show() {
    if (entry) void showResult(api, nav, projectId, entry.job, entry.place)
    close()
  }

  return (
    <div role="status" className={styles.region}>
      {entry && (
        <div className={`${layout.notice} ${layout.info} ${styles.line}`}>
          <Icon name="info" />
          <span className={styles.words}>
            {`${NOTICE_WORDS[entry.job.kind]}: ${whereText(entry.job, entry.place)}.`}
          </span>
          <button type="button" className={layout.small} onClick={show}>
            Show
          </button>
          <button
            type="button"
            className={`${layout.quiet} ${layout.small} ${layout.iconOnly} ${styles.dismiss}`}
            aria-label="Dismiss"
            onClick={close}
          >
            <Icon name="x" size="small" />
          </button>
        </div>
      )}
    </div>
  )
}
